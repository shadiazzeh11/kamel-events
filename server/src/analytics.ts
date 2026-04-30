import type { Event, FunnelResponse } from "../../shared/types.js";

/**
 * Compute the marketplace conversion funnel.
 *
 * For each step in `steps`, the result includes:
 *   - `count`: how many events of that type appear in the input
 *   - `conversion_from_previous`: count_step_n / count_step_{n-1} * 100,
 *     rounded to one decimal place
 *
 * Why this is a pure function (no DB, no Express, no clock):
 *   - The interesting logic — conversion math, divide-by-zero handling,
 *     ordering — is small but easy to get wrong. Keeping it pure means
 *     the unit tests can hand-roll Event arrays without booting SQLite,
 *     which keeps the test fast and the failure messages readable.
 *   - The route handler that calls this stays a thin shell: pull rows
 *     from the DB, hand them in, return JSON.
 *
 * Edge cases the caller should be aware of:
 *
 *   - Empty events array: every step has count 0 and every conversion
 *     is null. (For the first step this is by definition — there is
 *     no "previous" — and for subsequent steps the previous count
 *     itself is 0, which we treat as "no signal" rather than divide
 *     by zero.)
 *
 *   - A previous step with 0 events: conversion_from_previous is null,
 *     not Infinity or NaN. This communicates "no signal" to the client
 *     and avoids JSON serialization gotchas (JSON has no Infinity).
 *
 *   - The first step always has conversion_from_previous: null because
 *     there's nothing to compare against.
 */
export function calculateFunnel(
  events: Event[],
  steps: readonly string[],
): FunnelResponse {
  // Count event occurrences once. O(n) up front beats O(n * steps)
  // if the funnel ever grows past a handful of stages.
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
  }

  const out: FunnelResponse["steps"] = [];
  let prevCount: number | null = null;

  for (const step of steps) {
    const count = counts.get(step) ?? 0;
    const conversion =
      prevCount === null || prevCount === 0
        ? null
        : // Multiply by 1000 then divide by 10 so we round to one
          // decimal place without floating-point string juggling.
          Math.round((count / prevCount) * 1000) / 10;

    out.push({
      event_type: step,
      count,
      conversion_from_previous: conversion,
    });
    prevCount = count;
  }

  return { steps: out };
}
