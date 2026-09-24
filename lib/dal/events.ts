import "server-only";
import type { EventType } from "@/lib/schemas/event-type";

// Frozen contract (specs/CONTRACT-types.md): insert-only writes to `events`
// (docs/07). Called from Server Actions and Route Handlers with `after()`
// (generation, signup, purchase), and from `api/events` for the public
// `visit` type only (docs/04-nextjs.md: other types never accept a
// client-supplied event).
export type TrackEvent = {
  type: EventType;
  productId: string;
  userId: string | null;
  anonymousId: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export const track: (event: TrackEvent) => Promise<void> = async () => {
  throw new Error("not implemented");
};
