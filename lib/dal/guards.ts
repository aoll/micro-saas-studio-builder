import "server-only";
import { env } from "@/lib/env";

// Frozen contract (specs/CONTRACT-types.md): the demo-mode lock (docs/01 ›
// Mode démo public). Synchronous: `env.DEMO_MODE` is read inside each
// function, no database access.
export type Lockable = { isSeed: boolean };

// DEMO-mode (specs/DEMO-mode.md, orchestrator decision 3): a seeded row is
// locked only while the public demo is live. `DEMO_MODE=false` (local,
// tests) never locks anything; a non-seeded row (created by a visitor) is
// never locked either.
export const isEditable: (row: Lockable) => boolean = (row) => !(env.DEMO_MODE && row.isSeed);

// No exported error class (orchestrator decision 3): callers only need
// this to throw, never to branch on the error's identity.
export const assertEditable: (row: Lockable) => void = (row) => {
  if (!isEditable(row)) {
    throw new Error("demo_locked: seeded rows are read-only while the public demo is running");
  }
};
