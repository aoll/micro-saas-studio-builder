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

// Real behaviour (docs/01 › Mode démo public): `isEditable = (row) =>
// !(env.DEMO_MODE && row.isSeed)`, `env.DEMO_MODE` read inside the
// function so a single mutation of the mocked env between tests is enough
// (no module re-import needed).
describe("demo-mode lock (DEMO_MODE=true)", () => {
  it("isEditable is false for a seeded row", async () => {
    mockEnv.DEMO_MODE = true;
    const { isEditable } = await import("./guards");
    expect(isEditable({ isSeed: true })).toBe(false);
  });

  it("isEditable is true for a non-seeded row", async () => {
    mockEnv.DEMO_MODE = true;
    const { isEditable } = await import("./guards");
    expect(isEditable({ isSeed: false })).toBe(true);
  });

  it("assertEditable throws a demo_locked error for a seeded row", async () => {
    mockEnv.DEMO_MODE = true;
    const { assertEditable } = await import("./guards");
    expect(() => assertEditable({ isSeed: true })).toThrow(/^demo_locked:/);
  });

  it("assertEditable does not throw for a non-seeded row", async () => {
    mockEnv.DEMO_MODE = true;
    const { assertEditable } = await import("./guards");
    expect(() => assertEditable({ isSeed: false })).not.toThrow();
  });
});

describe("demo-mode lock (DEMO_MODE=false)", () => {
  it("isEditable is true for a seeded row", async () => {
    mockEnv.DEMO_MODE = false;
    const { isEditable } = await import("./guards");
    expect(isEditable({ isSeed: true })).toBe(true);
  });

  it("assertEditable does not throw for a seeded row", async () => {
    mockEnv.DEMO_MODE = false;
    const { assertEditable } = await import("./guards");
    expect(() => assertEditable({ isSeed: true })).not.toThrow();
  });
});
