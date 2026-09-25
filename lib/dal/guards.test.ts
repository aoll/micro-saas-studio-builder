import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { SEED_OWNER } from "@/scripts/seed";

// V1 stub (docs/11 › Les contrats gelés en V1: "assertEditable / isEditable
// (row) : ne bloquent rien"). `env.DEMO_MODE` is mocked explicitly (instead
// of relying on the worktree's `.env.local` happening to be `false`) so
// these assertions describe the V1 stub's actual promise — always
// editable, whatever the flag — ahead of DEMO-mode replacing it with the
// real `env.DEMO_MODE`-gated lock below.
const mockEnv = vi.hoisted(() => ({ DEMO_MODE: false }));
// Overrides only `DEMO_MODE`, live (a getter, not a spread value): the
// integration block below imports `@/lib/db`, which reads every other
// `env.*` field (DATABASE_URL…) through this same mocked module.
vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return {
    env: {
      ...actual.env,
      get DEMO_MODE() {
        return mockEnv.DEMO_MODE;
      },
    },
  };
});

const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

afterEach(() => {
  mockEnv.DEMO_MODE = false;
  requireAdmin.mockReset();
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

// Integration: `assertEditable` is not just a unit — every write DAL
// already calls it (product-status.ts, themes.ts, thresholds.ts,
// product-editor.ts), so this locks the whole app in one place. Exercised
// here against a throwaway seeded row and a real write DAL
// (updateStatus), on the shared worktree DB — created and deleted by this
// test alone (CLAUDE.md: only delete rows you own).
async function createThrowawaySeededProduct(): Promise<string> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const [row] = await db
    .insert(products)
    .values({
      slug: `guards-integration-${randomUUID()}`,
      themeId: editorial!.id,
      currentVersion: 1,
      locale: "fr",
      isSeed: true,
      createdBy: owner!.id,
    })
    .returning({ id: products.id });
  return row!.id;
}

describe("assertEditable locks a real write DAL", () => {
  it("blocks updateStatus on a seeded row when DEMO_MODE is true, without writing", async () => {
    mockEnv.DEMO_MODE = true;
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const productId = await createThrowawaySeededProduct();
    try {
      const before = await db.query.products.findFirst({ where: eq(products.id, productId) });
      const { updateStatus } = await import("./product-status");
      await expect(updateStatus(productId, "killed", "note")).rejects.toThrow(/^demo_locked:/);

      const after = await db.query.products.findFirst({ where: eq(products.id, productId) });
      expect(after?.status).toBe(before?.status);
      expect(after?.statusNote).toBe(before?.statusNote);
    } finally {
      await db.delete(products).where(eq(products.id, productId));
    }
  });

  it("lets updateStatus write to the same seeded row when DEMO_MODE is false", async () => {
    mockEnv.DEMO_MODE = false;
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const productId = await createThrowawaySeededProduct();
    try {
      const { updateStatus } = await import("./product-status");
      await updateStatus(productId, "killed", "note");

      const after = await db.query.products.findFirst({ where: eq(products.id, productId) });
      expect(after?.status).toBe("killed");
    } finally {
      await db.delete(products).where(eq(products.id, productId));
    }
  });
});
