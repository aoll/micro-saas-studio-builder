import { describe, expect, it } from "vitest";

// V1 stub (docs/11 › Les contrats gelés en V1: "assertEditable / isEditable
// (row) : ne bloquent rien"). Replaced by DEMO-mode's real
// `env.DEMO_MODE`-gated lock.
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
