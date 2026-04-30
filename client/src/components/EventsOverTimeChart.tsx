import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; count: number }[];
}

/*
 * Tooltip styling matches the locked palette. Recharts' default
 * tooltip renders bare HTML and breaks the visual register; passing
 * contentStyle once keeps every chart's hover state on-brand.
 */
const tooltipStyle = {
  backgroundColor: "white",
  border: "1px solid #e5e5e5",
  borderRadius: "6px",
  fontSize: "12px",
  padding: "6px 10px",
};

/**
 * Format a YYYY-MM-DD ISO date as a short human label ("Apr 24").
 * The backend returns gap-filled UTC dates; we anchor with a Z
 * suffix so the locale-aware formatter doesn't shift the day across
 * the user's timezone.
 */
function formatDateTick(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Line chart of total events per day over the past 7 days. The
 * series is dense (one row per day, gap-filled by the backend) so
 * the line is continuous regardless of activity.
 */
export function EventsOverTimeChart({ data }: Props) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide mb-4">
        Events Over Time
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#737373" }}
            tickFormatter={formatDateTick}
          />
          <YAxis tick={{ fontSize: 12, fill: "#737373" }} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={formatDateTick}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
