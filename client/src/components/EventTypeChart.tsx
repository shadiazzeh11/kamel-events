import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { event_type: string; count: number }[];
}

const tooltipStyle = {
  backgroundColor: "white",
  border: "1px solid #e5e5e5",
  borderRadius: "6px",
  fontSize: "12px",
  padding: "6px 10px",
};

/**
 * Horizontal bar chart of event volume by type.
 *
 * The backend already returns this list sorted by count (descending),
 * so the longest bar appears at the top. Visual priority maps to
 * numeric priority without any client-side sorting work — and a
 * future API change to a different sort order would automatically
 * flow through here without code edits.
 *
 * Horizontal layout (rather than vertical) is chosen so long event
 * type identifiers ("complete_reservation") render readably in a
 * left-aligned label rather than getting rotated 90° on an X-axis.
 */
export function EventTypeChart({ data }: Props) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide mb-4">
        Event Type Breakdown
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#737373" }} />
          <YAxis
            type="category"
            dataKey="event_type"
            width={150}
            tick={{ fontSize: 12, fill: "#525252" }}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
