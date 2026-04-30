import type { Event } from "../../../shared/types";

interface Props {
  events: Event[];
}

/*
 * Badge color mapping. Two specific event types get distinct
 * semantic colors (success-green for completed reservations, danger-
 * red for cancellations); everything else falls back to the dashboard
 * accent (indigo).
 *
 * Why a literal-string Map and not template-literal interpolation:
 *   Tailwind's JIT compiler scans source for class names at build
 *   time. A class string assembled at runtime — `bg-${color}-50` —
 *   would be invisible to the scanner and silently purged from the
 *   bundle. Spelling each combination out as a literal keeps every
 *   class in the compiled CSS.
 */
const BADGE_CLASSES: Record<string, string> = {
  complete_reservation: "bg-emerald-50 text-emerald-700",
  cancel_reservation: "bg-rose-50 text-rose-700",
};
const BADGE_DEFAULT = "bg-indigo-50 text-indigo-700";

function badgeClass(eventType: string): string {
  return BADGE_CLASSES[eventType] ?? BADGE_DEFAULT;
}

/**
 * Format the gap between an event timestamp and now.
 *
 * Both sides of the subtraction use UTC milliseconds (Date.now() and
 * new Date(iso).getTime()), so the user's local timezone never enters
 * the math. We deliberately avoid Intl.RelativeTimeFormat because its
 * output ("4 minutes ago" vs "4m ago") is wordier than what reads
 * well in a dense list.
 */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return iso.slice(0, 10);
}

/**
 * Truncate a JSON-stringified properties payload to a fixed display
 * width. Keeps row heights uniform regardless of payload size, which
 * matters in a 50-row scrolling list.
 */
function summarizeProperties(props: Record<string, unknown>): string {
  const text = JSON.stringify(props);
  return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

/**
 * The auto-refreshing live event feed.
 *
 * The polling that drives this list lives in App.tsx (one place owns
 * the timer, every component receives data as props). This component
 * is presentational only — given an array of events, it renders one
 * row per event, ordered as the API returned them (newest first).
 */
export function LiveEventStream({ events }: Props) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide">
        Live Event Stream
      </h2>
      <p className="text-xs text-neutral-500 mt-1 mb-4">
        auto-refreshes every 5 seconds
      </p>
      <div className="max-h-96 overflow-y-auto divide-y divide-neutral-100">
        {events.map((e) => (
          <div key={e.id} className="py-2 flex items-center gap-3">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass(e.event_type)}`}
            >
              {e.event_type}
            </span>
            <span className="text-sm text-neutral-900 font-mono">
              {e.user_id}
            </span>
            <span className="text-xs text-neutral-500">
              {timeAgo(e.timestamp)}
            </span>
            <span className="ml-auto text-xs text-neutral-500 font-mono truncate max-w-md">
              {summarizeProperties(e.properties)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
