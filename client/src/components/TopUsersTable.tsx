import type { TopUsersResponse } from "../../../shared/types";
import { formatCount } from "../format";

interface Props {
  topUsers: TopUsersResponse;
}

/**
 * Table of the top 10 users by event count.
 *
 * "Most active users" is a useful first-cut signal for a marketplace
 * founder: it surfaces candidates for user-research interviews,
 * highlights power users to make sure their experience is good, and
 * makes the long-tail shape of engagement visible at a glance.
 *
 * The user_id column is monospaced to make sequential identifiers
 * (user_001, user_002, ...) align vertically. Counts are right-
 * aligned with tabular-nums so the column reads as a column.
 */
export function TopUsersTable({ topUsers }: Props) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-600 uppercase tracking-wide mb-4">
        Top Users
      </h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide pb-3">
              User ID
            </th>
            <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wide pb-3">
              Event Count
            </th>
          </tr>
        </thead>
        <tbody>
          {topUsers.users.map((u) => (
            <tr
              key={u.user_id}
              className="hover:bg-neutral-50 border-t border-neutral-100"
            >
              <td className="text-sm text-neutral-900 py-2 font-mono">
                {u.user_id}
              </td>
              <td className="text-sm text-neutral-900 py-2 text-right tabular-nums">
                {formatCount(u.event_count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
