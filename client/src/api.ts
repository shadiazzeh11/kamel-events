import type {
  Event,
  OverviewResponse,
  FunnelResponse,
  TopUsersResponse,
  HealthResponse,
} from "../../shared/types";

/*
 * Single source of truth for HTTP calls to the backend.
 *
 * Every request is prefixed with `/api`. In dev, Vite's proxy
 * (configured in vite.config.ts) forwards `/api/*` to the backend
 * at http://localhost:4000 and strips the prefix before forwarding,
 * so a call to `/api/events` here arrives at the server as a bare
 * `GET /events`. In a production deploy, a real reverse proxy can
 * mirror the same convention — no component-level changes needed.
 *
 * Components do not call `fetch` directly. Routing every request
 * through this module means the prefix lives in exactly one file
 * and every response gets typed at the boundary.
 */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    // Surface enough context that a console reader can tell whether
    // this was a 4xx (bad request) or 5xx (server crash). Body may
    // not be JSON when something went badly wrong, so read as text.
    const body = await res.text().catch(() => "");
    throw new Error(
      `GET ${path} failed: ${res.status} ${res.statusText} ${body}`,
    );
  }
  return (await res.json()) as T;
}

export function fetchOverview(): Promise<OverviewResponse> {
  return getJson<OverviewResponse>("/analytics/overview");
}

export function fetchFunnel(): Promise<FunnelResponse> {
  return getJson<FunnelResponse>("/analytics/funnel");
}

export function fetchTopUsers(): Promise<TopUsersResponse> {
  return getJson<TopUsersResponse>("/analytics/users");
}

export function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/health");
}

export function fetchRecentEvents(limit: number = 50): Promise<Event[]> {
  return getJson<Event[]>(`/events?limit=${limit}`);
}
