import Database from "better-sqlite3";
import path from "node:path";
import type { Event } from "../../shared/types.js";

/*
 * Persistence is a single SQLite file via better-sqlite3.
 *
 * Why SQLite (and why better-sqlite3 specifically):
 *   - Zero ops: no Docker, no daemon, the database is a file in the
 *     repo's working tree.
 *   - Synchronous API: better-sqlite3 binds directly to the C library,
 *     so calls return values rather than promises. For a single-process
 *     Express server at the scale of a take-home (hundreds-to-thousands
 *     of rows), this trades concurrent writes for a much simpler
 *     codebase — no async/await on every row, no callback nesting.
 *   - Synchronous + Node's single thread means we don't need any
 *     locking ourselves; the better-sqlite3 driver serializes for us.
 *
 * If we ever needed real concurrency or a separate DB box, the helpers
 * below are the only surface that touches the driver, so swapping is
 * a contained change.
 */

// `import.meta.dirname` is ESM-native and available in Node 20.11+.
// Resolving relative to this source file means the DB file lands in
// /server/data.db regardless of where `npm run dev` or `npm run seed`
// is invoked from.
const DB_PATH = path.join(import.meta.dirname, "..", "data.db");

export const db = new Database(DB_PATH);

// WAL mode lets readers (analytics queries) run alongside writers
// (POST /events, seed) without blocking. Cheap to enable.
db.pragma("journal_mode = WAL");

/*
 * Schema is intentionally minimal: a flat events table with a JSON
 * blob for properties.
 *
 *   - properties is TEXT because SQLite has no native JSON type.
 *     Storing as TEXT and JSON.parse'ing on read is the canonical
 *     pattern; it keeps writes a single bind and avoids us inventing
 *     a relational model for an open-ended payload.
 *   - The three indexes cover the WHERE / GROUP BY clauses used by
 *     every analytics query (filter by type, group by user, filter
 *     by timestamp range). They cost negligible disk for our row
 *     counts and turn O(n) scans into O(log n) lookups.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    properties TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type      ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_user      ON events(user_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`);

/*
 * Internal row shape — matches the column types 1:1 (so `properties`
 * is still a JSON string at this layer). Helpers transform rows into
 * the shared Event type before returning to callers; this keeps the
 * "stored bytes" representation private to db.ts.
 */
type EventRow = {
  id: string;
  event_type: string;
  user_id: string;
  timestamp: string;
  properties: string;
};

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    event_type: row.event_type,
    user_id: row.user_id,
    timestamp: row.timestamp,
    properties: JSON.parse(row.properties) as Record<string, unknown>,
  };
}

/*
 * Prepared statements are compiled once at module load. better-sqlite3's
 * docs explicitly recommend this pattern: the parser/planner cost is
 * paid up front, and per-call overhead drops to roughly a function
 * call. It also keeps the SQL co-located, so a reviewer can scan the
 * full query surface in one place.
 */
const stmtInsert = db.prepare<[string, string, string, string, string]>(`
  INSERT INTO events (id, event_type, user_id, timestamp, properties)
  VALUES (?, ?, ?, ?, ?)
`);

const stmtGetAll = db.prepare<[], EventRow>(`
  SELECT id, event_type, user_id, timestamp, properties
  FROM events
  ORDER BY timestamp ASC
`);

const stmtGetRecent = db.prepare<[number], EventRow>(`
  SELECT id, event_type, user_id, timestamp, properties
  FROM events
  ORDER BY timestamp DESC
  LIMIT ?
`);

const stmtCountAll = db.prepare<[], { count: number }>(
  `SELECT COUNT(*) AS count FROM events`,
);

const stmtCountUsers = db.prepare<[], { count: number }>(
  `SELECT COUNT(DISTINCT user_id) AS count FROM events`,
);

const stmtCountSince = db.prepare<[string], { count: number }>(
  `SELECT COUNT(*) AS count FROM events WHERE timestamp >= ?`,
);

// Bucket rows by date string. We slice the first 10 chars of the ISO
// timestamp ("YYYY-MM-DD"), which is correct because we always store
// timestamps in UTC ISO 8601. SQLite's strftime would also work, but
// SUBSTR is one fewer moving part and equally fast at this scale.
const stmtGroupByDay = db.prepare<
  [string],
  { date: string; count: number }
>(`
  SELECT
    SUBSTR(timestamp, 1, 10) AS date,
    COUNT(*)                 AS count
  FROM events
  WHERE timestamp >= ?
  GROUP BY date
  ORDER BY date ASC
`);

const stmtGroupByType = db.prepare<
  [],
  { event_type: string; count: number }
>(`
  SELECT event_type, COUNT(*) AS count
  FROM events
  GROUP BY event_type
  ORDER BY count DESC
`);

const stmtTopUsers = db.prepare<
  [number],
  { user_id: string; event_count: number }
>(`
  SELECT user_id, COUNT(*) AS event_count
  FROM events
  GROUP BY user_id
  ORDER BY event_count DESC
  LIMIT ?
`);

const stmtClear = db.prepare(`DELETE FROM events`);

export function insertEvent(event: Event): void {
  stmtInsert.run(
    event.id,
    event.event_type,
    event.user_id,
    event.timestamp,
    JSON.stringify(event.properties),
  );
}

export function getAllEvents(): Event[] {
  return stmtGetAll.all().map(rowToEvent);
}

export function getRecentEvents(limit: number): Event[] {
  return stmtGetRecent.all(limit).map(rowToEvent);
}

export function countEvents(): number {
  return stmtCountAll.get()!.count;
}

export function countUniqueUsers(): number {
  return stmtCountUsers.get()!.count;
}

export function countEventsSince(isoTimestamp: string): number {
  return stmtCountSince.get(isoTimestamp)!.count;
}

/**
 * Returns a continuous date series — every day in
 * [today - daysBack + 1, today], with count 0 for days that had no
 * events.
 *
 * Why gap-fill in JS instead of SQL: SQLite has no portable
 * GENERATE_SERIES, and emulating it with recursive CTEs is more
 * surface area than a 7-iteration loop. The series is tiny (one
 * row per day) so this is essentially free.
 *
 * Dates are rendered as UTC YYYY-MM-DD so they sort lexicographically
 * and don't shift across the client's timezone.
 */
export function groupEventsByDay(
  daysBack: number,
): { date: string; count: number }[] {
  // Anchor the range to midnight UTC of today, then walk back daysBack-1
  // days so the result includes today as the final entry.
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (daysBack - 1));
  const startIso = start.toISOString();

  // Pull whatever days have data, then merge into the full range.
  const haveByDate = new Map<string, number>();
  for (const row of stmtGroupByDay.all(startIso)) {
    haveByDate.set(row.date, row.count);
  }

  const out: { date: string; count: number }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < daysBack; i++) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, count: haveByDate.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function groupEventsByType(): { event_type: string; count: number }[] {
  return stmtGroupByType.all();
}

export function topUsers(
  limit: number,
): { user_id: string; event_count: number }[] {
  return stmtTopUsers.all(limit);
}

export function clearAllEvents(): void {
  stmtClear.run();
}

// Exported so index.ts can log it on startup; helps a reviewer locate
// the actual database file in one glance.
export const DB_FILE_PATH = DB_PATH;
