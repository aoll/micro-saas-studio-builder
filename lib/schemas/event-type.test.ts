import { describe, expect, it } from "vitest";
import { eventTypeSchema, type EventType } from "./event-type";

describe("eventTypeSchema", () => {
  it.each(["visit", "first_generation", "signup", "generation", "credits_exhausted", "purchase"] satisfies EventType[])(
    "accepts %s",
    (value) => {
      expect(eventTypeSchema.safeParse(value).success).toBe(true);
    },
  );

  it("rejects an unknown event type", () => {
    expect(eventTypeSchema.safeParse("click").success).toBe(false);
  });
});
