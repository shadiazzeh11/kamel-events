import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { Event } from "../../../shared/types.js";
import { insertEvent, getRecentEvents } from "../db.js";

/*
 * POST /events validation schema.
 *
 * Decisions baked in:
 *
 *   - event_type is a free-form string, length-bounded only.
 *     The system is intentionally generic: marketplace funnel types
 *     ("search", "view_trip", etc.) are conventions used by the seed
 *     data and the dashboard, not constraints. A future product
 *     experiment can introduce a new event type without a server
 *     change. The 100-char cap exists to keep the column from
 *     accidentally storing a stack trace.
 *
 *   - user_id is also free-form. We don't model users here; whoever
 *     emits events is responsible for providing a stable identifier.
 *     Length is bounded for the same reason.
 *
 *   - timestamp is optional. If the caller supplies one, we accept
 *     ISO 8601 (useful for backfilling or batch ingestion); otherwise
 *     the server stamps with its own clock at insert time. Either way
 *     the stored value is an ISO string.
 *
 *   - properties is an arbitrary string-keyed object, defaulting to {}.
 *     The default keeps the downstream type stable so analytics code
 *     never has to handle null/undefined properties.
 */
const incomingEventSchema = z.object({
  event_type: z.string().min(1).max(100),
  user_id: z.string().min(1).max(100),
  timestamp: z.string().datetime().optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export const eventsRouter = Router();

/**
 * POST /events — ingest a single event.
 *
 * The server generates `id` (UUID v4) so callers cannot collide on
 * IDs or backfill by reusing them. On validation failure we return
 * 400 with Zod's issues array — Zod 4 exposes these at .error.issues
 * (renamed from .errors in v3, a real-world breaking change).
 */
eventsRouter.post("/events", (req, res) => {
  const parsed = incomingEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid event payload",
      issues: parsed.error.issues,
    });
    return;
  }

  const event: Event = {
    id: uuidv4(),
    event_type: parsed.data.event_type,
    user_id: parsed.data.user_id,
    timestamp: parsed.data.timestamp ?? new Date().toISOString(),
    properties: parsed.data.properties,
  };

  insertEvent(event);
  res.status(201).json(event);
});

/**
 * GET /events?limit=N — return the most recent N events.
 *
 * `limit` is parsed defensively: a non-numeric or absent value falls
 * back to 50, and we cap at 500 so a malicious or curious caller
 * can't request a million-row payload. 50 is enough to power the
 * dashboard's live event stream panel.
 */
eventsRouter.get("/events", (req, res) => {
  const raw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(Math.floor(raw), 1), 500)
    : 50;
  res.json(getRecentEvents(limit));
});
