import { vi } from "vitest";

// `server-only` throws when imported outside a Server Component; tests run in
// plain Node, so this makes every `import "server-only"` a no-op.
vi.mock("server-only", () => ({}));
