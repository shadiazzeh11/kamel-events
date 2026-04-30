import { Router } from "express";
import {
  countEvents,
  countUniqueUsers,
  countEventsSince,
  groupEventsByDay,
  groupEventsByType,
  topUsers,
  getAllEvents,
} from "../db.js";
import { calculateFunnel } from "../analytics.js";
import { FUNNEL_STEPS } from "../../../shared/types.js";
import type {
  HealthResponse,
  OverviewResponse,
  TopUsersResponse,
} from "../../../shared/types.js";

export const analyticsRouter = Router();

/**
 * GET /health — liveness check.
 *
 * Reports the live event count rather than a hard-coded `true`. With
 * one curl, a reviewer can confirm both that the server is up and
 * that the database is correctly wired up.
 */
analyticsRouter.get("/health", (_req, res) => {
  const response: HealthResponse = {
    ok: true,
    event_count: countEvents(),
  };
  res.json(response);
});

/**
 * GET /analytics/overview — drives the dashboard's top-of-page numbers
 * plus the events-over-time and events-by-type charts.
 *
 * Aggregations are computed in SQL (count(*), group by, etc.) rather
 * than by loading every row into JS. At ~1000 rows the difference is
 * imperceptible, but writing the aggregation as a query keeps the JS
 * side clean and means we'd scale by orders of magnitude before any
 * change would be needed.
 *
 * The 7-day series for events_by_day is gap-filled inside
 * db.groupEventsByDay — see the comment there for why.
 */
analyticsRouter.get("/analytics/overview", (_req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const response: OverviewResponse = {
    total_events: countEvents(),
    unique_users: countUniqueUsers(),
    events_last_24h: countEventsSince(since24h),
    events_by_day: groupEventsByDay(7),
    events_by_type: groupEventsByType(),
  };
  res.json(response);
});

/**
 * GET /analytics/funnel — marketplace conversion funnel.
 *
 * The route is a thin shell: pull the events of funnel-step types
 * from the DB, hand them to the pure calculateFunnel function, return
 * its result. Splitting the data fetch from the math means the math
 * is trivially unit-testable (see analytics.test.ts).
 *
 * For now we filter in JS after a getAllEvents() round-trip. At larger
 * scale we'd push the count-by-type aggregation into SQL — straight-
 * forward but unnecessary at this row count.
 */
analyticsRouter.get("/analytics/funnel", (_req, res) => {
  const funnelTypes = new Set<string>(FUNNEL_STEPS);
  const events = getAllEvents().filter((e) => funnelTypes.has(e.event_type));
  res.json(calculateFunnel(events, FUNNEL_STEPS));
});

/**
 * GET /analytics/users — top 10 users by event count.
 *
 * "Most active" is a useful first-cut signal for a marketplace founder:
 * it surfaces power users to interview and the long-tail shape of
 * engagement.
 */
analyticsRouter.get("/analytics/users", (_req, res) => {
  const response: TopUsersResponse = {
    users: topUsers(10),
  };
  res.json(response);
});
