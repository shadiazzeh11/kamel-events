/**
 * Shared event type used by both the server (ingestion + storage)
 * and the client (rendering). Importing from a single source means
 * any change to the schema is caught at compile time on both sides.
 *
 * Imported via relative path from both apps:
 *   server: ../../shared/types
 *   client: ../../shared/types
 */
export interface Event {
  id: string;
  event_type: string;
  user_id: string;
  timestamp: string; // ISO 8601
  properties: Record<string, unknown>;
}

/**
 * Marketplace funnel steps in order. The backend accepts ANY
 * event_type string — these are conventions used by the seed data
 * and the funnel visualization, not constraints.
 */
export const FUNNEL_STEPS = [
  "search",
  "view_trip",
  "start_reservation",
  "complete_reservation",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const ALL_EVENT_TYPES = [
  ...FUNNEL_STEPS,
  "cancel_reservation",
  "driver_listed_trip",
  "user_signed_up",
] as const;

/**
 * Analytics response shapes — defined once, used by both sides.
 */
export interface OverviewResponse {
  total_events: number;
  unique_users: number;
  events_last_24h: number;
  events_by_day: { date: string; count: number }[];
  events_by_type: { event_type: string; count: number }[];
}

export interface FunnelResponse {
  steps: {
    event_type: string;
    count: number;
    conversion_from_previous: number | null;
  }[];
}

export interface TopUsersResponse {
  users: { user_id: string; event_count: number }[];
}

export interface HealthResponse {
  ok: boolean;
  event_count: number;
}
