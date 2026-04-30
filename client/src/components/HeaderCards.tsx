import type { OverviewResponse } from "../../../shared/types";
import { formatCount } from "../format";

interface Props {
  overview: OverviewResponse;
}

/**
 * Three big-number cards across the top of the dashboard.
 *
 * The metrics here are the ones a marketplace founder glances at
 * first: total volume (is the system used?), breadth of activity
 * (how many distinct users?), and recent momentum (last 24h to
 * gauge trajectory). Headline numbers are the single most-stared-at
 * UI element on this page; they get top-of-page real estate by design.
 */
export function HeaderCards({ overview }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card
        label="Total Events"
        value={overview.total_events}
        sub="since launch"
      />
      <Card
        label="Unique Users"
        value={overview.unique_users}
        sub="distinct user_ids"
      />
      <Card
        label="Last 24 Hours"
        value={overview.events_last_24h}
        sub="events ingested"
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide mb-4">
        {label}
      </h2>
      <p className="text-3xl font-semibold text-neutral-900 tabular-nums">
        {formatCount(value)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}
