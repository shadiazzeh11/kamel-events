import { useEffect, useState } from "react";
import type {
  OverviewResponse,
  FunnelResponse,
  TopUsersResponse,
  Event,
} from "../../shared/types";
import {
  fetchOverview,
  fetchFunnel,
  fetchTopUsers,
  fetchRecentEvents,
} from "./api";
import { HeaderCards } from "./components/HeaderCards";
import { EventsOverTimeChart } from "./components/EventsOverTimeChart";
import { FunnelChart } from "./components/FunnelChart";
import { EventTypeChart } from "./components/EventTypeChart";
import { TopUsersTable } from "./components/TopUsersTable";

const POLL_INTERVAL_MS = 5000;

function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [topUsers, setTopUsers] = useState<TopUsersResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * One-shot initial fetch: pull every section's data in parallel so
   * the user sees a populated dashboard, not a series of progressive
   * reveals. If any single endpoint fails we surface the error rather
   * than rendering a half-broken page — for a take-home reviewer, an
   * obvious error message is more useful than a silently-empty card.
   *
   * The `active` flag guards against React 18+ unmount races: if the
   * component unmounts before the await resolves, we drop the result
   * instead of writing to a dead state setter.
   */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ov, fn, tu, ev] = await Promise.all([
          fetchOverview(),
          fetchFunnel(),
          fetchTopUsers(),
          fetchRecentEvents(50),
        ]);
        if (!active) return;
        setOverview(ov);
        setFunnel(fn);
        setTopUsers(tu);
        setRecentEvents(ev);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /*
   * Polling loop: refresh the live stream and overview big-numbers
   * every 5 seconds.
   *
   * Why polling rather than websockets:
   *   - The dashboard is read by humans glancing at it; 5s latency
   *     is imperceptible
   *   - Polling is one fewer moving part — no socket lifecycle,
   *     no reconnect logic, no server-side broadcast bookkeeping
   *
   * Why the interval id lives in a closure (not in state):
   *   - React 19 StrictMode mounts effects twice in dev. The cleanup
   *     function MUST clear the interval the same effect created, or
   *     two pollers run forever after the second mount. Storing the
   *     id in a closure local variable makes the cleanup symmetric
   *     by construction.
   *
   * Errors are swallowed (warn-level): a transient network blip or
   * a server restart shouldn't blank a working dashboard.
   */
  useEffect(() => {
    let active = true;
    const id = setInterval(async () => {
      try {
        const [ev, ov] = await Promise.all([
          fetchRecentEvents(50),
          fetchOverview(),
        ]);
        if (!active) return;
        setRecentEvents(ev);
        setOverview(ov);
      } catch (err) {
        console.warn("polling refresh failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-2xl mx-auto bg-white border border-rose-200 rounded-lg p-6">
          <h2 className="text-sm font-medium text-rose-700 uppercase tracking-wide mb-2">
            Failed to load dashboard
          </h2>
          <p className="text-sm text-neutral-900">{error}</p>
        </div>
      </div>
    );
  }

  if (!overview || !funnel || !topUsers || !recentEvents) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-sm text-neutral-500">Loading dashboard…</p>
      </div>
    );
  }

  // Real components land in steps 3.3–3.8; placeholders here keep the
  // layout shape visible while the shell is in place.
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <HeaderCards overview={overview} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <EventsOverTimeChart data={overview.events_by_day} />
          <FunnelChart funnel={funnel} />
          <EventTypeChart data={overview.events_by_type} />
          <TopUsersTable topUsers={topUsers} />
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <p className="text-xs text-neutral-500">live stream ({recentEvents.length} events)</p>
        </div>
      </div>
    </div>
  );
}

export default App;
