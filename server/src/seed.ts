import { v4 as uuidv4 } from "uuid";
import {
  clearAllEvents,
  insertEvent,
  countEvents,
  groupEventsByType,
  db,
} from "./db.js";
import type { Event } from "../../shared/types.js";

/*
 * Seed script: builds a realistic college-rideshare marketplace event
 * stream so the dashboard has something interesting to display before
 * any real traffic exists.
 *
 * Idempotent: clears existing rows first, so running `npm run seed`
 * twice produces the same result rather than 1800 rows. The 900-row
 * insert is wrapped in a single SQLite transaction so it costs roughly
 * one fsync rather than 900 — without that, even on M1 the seed felt
 * sluggish.
 *
 * The event volumes follow the funnel-shaped pattern a marketplace
 * actually exhibits (more searches than reservations, predictable
 * day/night activity curve, a handful of power users and a long tail
 * of occasional users). The numbers are fabricated, but the shape is
 * faithful: the conversion rates between funnel steps map to the
 * 70% / 51% / 68% drop-off the take-home plan calls for.
 */

const CAMPUSES = [
  "Cornell",
  "Binghamton",
  "Syracuse",
  "NYC",
  "Boston",
  "Philadelphia",
] as const;

// Per-type event counts. Sum is 900. The funnel ratios are the
// engineered part:
//   view_trip / search             = 245 / 350 ≈ 70%
//   start / view                   = 125 / 245 ≈ 51%
//   complete / start               =  85 / 125 = 68%
const COUNTS: Record<string, number> = {
  search: 350,
  view_trip: 245,
  start_reservation: 125,
  complete_reservation: 85,
  cancel_reservation: 40,
  driver_listed_trip: 30,
  user_signed_up: 25,
};

// Stable, padded user IDs. Using a fixed list of 50 means the top-users
// query will always have something interesting to show.
const USER_IDS: string[] = Array.from({ length: 50 }, (_, i) =>
  `user_${String(i + 1).padStart(3, "0")}`,
);

/**
 * Power-law-ish user picker: bias picks toward the front of the array.
 * Squaring (or higher-exponentiating) a uniform [0,1] sample concentrates
 * mass near zero, which means lower indices win disproportionately —
 * the desired "few power users, long tail" distribution.
 */
function pickUserId(): string {
  const u = Math.random();
  const idx = Math.min(
    USER_IDS.length - 1,
    Math.floor(Math.pow(u, 1.7) * USER_IDS.length),
  );
  return USER_IDS[idx]!;
}

/**
 * Pick an ISO timestamp within the past 7 days, weighted toward
 * 9am-9pm activity so the events-over-time chart looks like real
 * usage instead of uniform random noise.
 */
const HOUR_WEIGHTS = [
  // 0   1   2   3   4   5   6   7   8
  1, 1, 1, 1, 1, 1, 1, 1, 2,
  // 9  10  11  12  13  14  15  16  17
  5, 6, 7, 8, 8, 7, 7, 8, 9,
  // 18  19  20  21
  10, 9, 7, 5,
  // 22  23
  3, 2,
];
const HOUR_WEIGHT_TOTAL = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);

function pickWeightedHour(): number {
  let r = Math.random() * HOUR_WEIGHT_TOTAL;
  for (let h = 0; h < 24; h++) {
    r -= HOUR_WEIGHTS[h]!;
    if (r <= 0) return h;
  }
  return 23;
}

function pickTimestamp(): string {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const day = new Date(sevenDaysAgo + Math.random() * (now - sevenDaysAgo));
  day.setUTCHours(
    pickWeightedHour(),
    Math.floor(Math.random() * 60),
    Math.floor(Math.random() * 60),
    0,
  );
  // Replacing the hour can push an event for "today" past the current
  // wall-clock time, producing a future-dated timestamp that would
  // sort above genuinely-fresh POSTs in the live stream. Clamp to now
  // so seeded data stays in the past where it belongs.
  if (day.getTime() > now) {
    return new Date(now - Math.floor(Math.random() * 60_000)).toISOString();
  }
  return day.toISOString();
}

function pickCampus(): string {
  return CAMPUSES[Math.floor(Math.random() * CAMPUSES.length)]!;
}

function pickDifferentCampus(notThisOne: string): string {
  let candidate = pickCampus();
  while (candidate === notThisOne) candidate = pickCampus();
  return candidate;
}

function pickFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Build a plausible properties object for the given event type. Mirrors
 * the kind of payload a real marketplace client would send: route info
 * for search/view/list events, money for reservation events, a free-form
 * reason for cancels.
 */
function buildProperties(eventType: string): Record<string, unknown> {
  switch (eventType) {
    case "search": {
      const from = pickCampus();
      const dateOffsetDays = Math.floor(Math.random() * 14);
      const tripDate = new Date(Date.now() + dateOffsetDays * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        from_campus: from,
        to_campus: pickDifferentCampus(from),
        date: tripDate,
      };
    }
    case "view_trip": {
      const from = pickCampus();
      return {
        trip_id: `trip_${Math.floor(Math.random() * 1000)}`,
        from_campus: from,
        to_campus: pickDifferentCampus(from),
      };
    }
    case "start_reservation":
      return {
        trip_id: `trip_${Math.floor(Math.random() * 1000)}`,
        seats: 1 + Math.floor(Math.random() * 3),
        price_usd: 15 + Math.floor(Math.random() * 35),
      };
    case "complete_reservation":
      return {
        trip_id: `trip_${Math.floor(Math.random() * 1000)}`,
        total_paid_usd: 15 + Math.floor(Math.random() * 50),
      };
    case "cancel_reservation":
      return {
        trip_id: `trip_${Math.floor(Math.random() * 1000)}`,
        reason: pickFrom([
          "plans_changed",
          "found_other_ride",
          "trip_canceled_by_driver",
        ]),
      };
    case "driver_listed_trip": {
      const from = pickCampus();
      return {
        trip_id: `trip_${Math.floor(Math.random() * 1000)}`,
        from_campus: from,
        to_campus: pickDifferentCampus(from),
        seats_available: 2 + Math.floor(Math.random() * 3),
      };
    }
    case "user_signed_up":
      return {
        campus: pickCampus(),
        referral: pickFrom([
          "friend",
          "instagram",
          "campus_flyer",
          "organic",
        ]),
      };
    default:
      return {};
  }
}

clearAllEvents();

// All inserts inside one transaction. better-sqlite3 exposes
// db.transaction(fn) which returns a function; calling it runs `fn`
// inside BEGIN ... COMMIT and rolls back on throw.
const seedAll = db.transaction(() => {
  const events: Event[] = [];
  for (const [eventType, count] of Object.entries(COUNTS)) {
    for (let i = 0; i < count; i++) {
      events.push({
        id: uuidv4(),
        event_type: eventType,
        user_id: pickUserId(),
        timestamp: pickTimestamp(),
        properties: buildProperties(eventType),
      });
    }
  }
  for (const e of events) insertEvent(e);
});

seedAll();

const total = countEvents();
const breakdown = groupEventsByType();
console.log(`Seeded ${total} events across ${USER_IDS.length} users.`);
console.log("Per-type breakdown:");
for (const row of breakdown) {
  console.log(`  ${row.event_type.padEnd(22)} ${row.count}`);
}
