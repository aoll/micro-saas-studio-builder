import { z } from "zod";

// Steps of the funnel and actions tracked in `events` (docs/07).
export const eventTypeSchema = z.enum([
  "visit",
  "first_generation",
  "signup",
  "generation",
  "credits_exhausted",
  "purchase",
]);

export type EventType = z.infer<typeof eventTypeSchema>;
