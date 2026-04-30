import type { FunnelResponse } from "../../../shared/types";
import { formatCount } from "../format";

interface Props {
  funnel: FunnelResponse;
}

/**
 * Format an event_type identifier ("start_reservation") as a human
 * label ("Start Reservation").
 */
function humanize(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * The marketplace conversion funnel as a stack of horizontal bars.
 *
 * Why hand-rolled bars instead of Recharts' built-in FunnelChart:
 *   - The Recharts widget over-styles its output (trapezoids,
 *     gradients) and is hard to align with our locked palette
 *   - A flex row with a proportional-width fill div renders in
 *     a fraction of the code, looks cleaner against the rest of
 *     the dashboard, and is straightforwardly responsive
 *
 * The conversion percentage rendered on the right is the one piece
 * of analytical signal a marketplace founder cares most about — the
 * shape of the drop-off between steps. Showing it next to each
 * transition (rather than as a separate readout) keeps the reading
 * order top-to-bottom: step → its size → how it converts to the
 * next step.
 */
export function FunnelChart({ funnel }: Props) {
  const firstCount = funnel.steps[0]?.count ?? 0;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide mb-4">
        Marketplace Funnel
      </h2>
      <div className="space-y-3">
        {funnel.steps.map((step) => {
          // Bar width is proportional to the first step's count so the
          // top of funnel always renders full-width. Guard against
          // firstCount === 0 producing NaN widths on an empty dataset.
          const widthPct =
            firstCount === 0 ? 0 : (step.count / firstCount) * 100;

          return (
            <div key={step.event_type} className="flex items-center gap-4">
              <div className="w-44 text-sm text-neutral-900">
                {humanize(step.event_type)}
              </div>

              <div className="flex-1 relative h-8 bg-indigo-50 rounded">
                <div
                  className="absolute inset-y-0 left-0 bg-indigo-600 rounded flex items-center px-3"
                  style={{ width: `${widthPct}%` }}
                >
                  {/* Render the count inside the colored portion when
                      there's room, otherwise to the right of it. The
                      12% threshold is just enough that a 3-character
                      number never overflows into the unfilled track. */}
                  {widthPct > 12 && (
                    <span className="text-xs font-medium text-white tabular-nums">
                      {formatCount(step.count)}
                    </span>
                  )}
                </div>
                {widthPct <= 12 && (
                  <span
                    className="absolute inset-y-0 flex items-center pl-2 text-xs text-neutral-900 tabular-nums"
                    style={{ left: `${widthPct}%` }}
                  >
                    {formatCount(step.count)}
                  </span>
                )}
              </div>

              <div className="w-20 text-right text-xs tabular-nums">
                {step.conversion_from_previous === null ? (
                  <span className="text-neutral-500">—</span>
                ) : (
                  <span className="text-emerald-600 font-medium">
                    ↓ {step.conversion_from_previous}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
