import { describe, it, expect } from "vitest";
import { calculateFunnel } from "./analytics.js";
import type { Event } from "../../shared/types.js";

const STEPS = [
  "search",
  "view_trip",
  "start_reservation",
  "complete_reservation",
] as const;

/**
 * Hand-roll an event array with a chosen count per type. The other
 * Event fields don't affect calculateFunnel's output, so we use
 * placeholders. This keeps each test's intent obvious from its
 * input shape.
 */
function makeEvents(byType: Record<string, number>): Event[] {
  const events: Event[] = [];
  for (const [type, count] of Object.entries(byType)) {
    for (let i = 0; i < count; i++) {
      events.push({
        id: `${type}_${i}`,
        event_type: type,
        user_id: "user_test",
        timestamp: "2026-04-30T00:00:00.000Z",
        properties: {},
      });
    }
  }
  return events;
}

describe("calculateFunnel", () => {
  it("returns zero counts and null conversions for an empty events array", () => {
    const result = calculateFunnel([], STEPS);
    expect(result.steps).toHaveLength(STEPS.length);
    for (const step of result.steps) {
      expect(step.count).toBe(0);
      expect(step.conversion_from_previous).toBeNull();
    }
  });

  it("computes counts and step-over-step conversion percentages", () => {
    const events = makeEvents({
      search: 100,
      view_trip: 70,
      start_reservation: 50,
      complete_reservation: 30,
    });

    const result = calculateFunnel(events, STEPS);

    expect(result.steps[0]).toEqual({
      event_type: "search",
      count: 100,
      // First step has no previous; conversion is undefined by definition.
      conversion_from_previous: null,
    });
    expect(result.steps[1]).toEqual({
      event_type: "view_trip",
      count: 70,
      conversion_from_previous: 70,
    });
    expect(result.steps[2]).toEqual({
      event_type: "start_reservation",
      count: 50,
      // 50 / 70 = 0.7142857..., rounded to one decimal = 71.4
      conversion_from_previous: 71.4,
    });
    expect(result.steps[3]).toEqual({
      event_type: "complete_reservation",
      count: 30,
      conversion_from_previous: 60,
    });
  });

  it("returns null (not Infinity or NaN) when a previous step has zero events", () => {
    // view_trip is intentionally absent from the input — the funnel
    // calculation must not divide by zero when computing the next
    // step's conversion.
    const events = makeEvents({
      search: 100,
      start_reservation: 50,
      complete_reservation: 30,
    });

    const result = calculateFunnel(events, STEPS);

    // view_trip itself: zero events out of 100 previous → exactly 0%,
    // which is a meaningful "everyone dropped off" signal, not null.
    expect(result.steps[1]).toEqual({
      event_type: "view_trip",
      count: 0,
      conversion_from_previous: 0,
    });

    // start_reservation: previous (view_trip) was zero, so conversion
    // is null — "no signal" rather than infinity or NaN, which would
    // break JSON serialization and confuse the chart.
    expect(result.steps[2].count).toBe(50);
    expect(result.steps[2].conversion_from_previous).toBeNull();

    // complete_reservation has a non-zero previous again, so its
    // conversion resumes being a real number.
    expect(result.steps[3]).toEqual({
      event_type: "complete_reservation",
      count: 30,
      conversion_from_previous: 60,
    });
  });
});
