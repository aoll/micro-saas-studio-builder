import "server-only";

// Frozen contract (specs/CONTRACT-types.md): the demo-mode lock (docs/01 ›
// Mode démo public). Synchronous: the real implementation only reads
// `env.DEMO_MODE`, no database access. DEMO-mode replaces the throwing
// bodies; the error type thrown by `assertEditable` is deliberately not
// specified here.
export type Lockable = { isSeed: boolean };

export const assertEditable: (row: Lockable) => void = () => {
  throw new Error("not implemented");
};

export const isEditable: (row: Lockable) => boolean = () => {
  throw new Error("not implemented");
};
