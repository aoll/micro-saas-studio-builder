import { afterEach, describe, expect, it, vi } from "vitest";

// V1 stub (docs/11 › Les contrats gelés en V1: "assertEditable / isEditable
// (row) : ne bloquent rien"). `env.DEMO_MODE` is mocked explicitly (instead
// of relying on the worktree's `.env.local` happening to be `false`) so
// these assertions describe the V1 stub's actual promise — always
// editable, whatever the flag — ahead of DEMO-mode replacing it with the
// real `env.DEMO_MODE`-gated lock below.
const mockEnv = vi.hoisted(() => ({ DEMO_MODE: false }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

afterEach(() => {
  mockEnv.DEMO_MODE = false;
  vi.resetModules();
});

describe("isEditable", () => {
  it("returns true for a seeded row", async () => {
    const { isEditable } = await import("./guards");
    expect(isEditable({ isSeed: true })).toBe(true);
  });

  it("returns true for a non-seeded row", async () => {
    const { isEditable } = await import("./guards");
    expect(isEditable({ isSeed: false })).toBe(true);
  });
});

describe("assertEditable", () => {
  it("does not throw for a seeded row", async () => {
    const { assertEditable } = await import("./guards");
    expect(() => assertEditable({ isSeed: true })).not.toThrow();
  });
});
