import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { SEED_OWNER } from "@/scripts/seed";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

afterEach(() => {
  requireAdmin.mockReset();
});

async function createTestProduct(): Promise<string> {
  const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const [row] = await db
    .insert(products)
    .values({
      slug: `contract-status-${randomUUID()}`,
      themeId: editorial!.id,
      currentVersion: 1,
      locale: "fr",
      createdBy: owner!.id,
    })
    .returning({ id: products.id });
  return row!.id;
}

describe("updateStatus", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { updateStatus } = await import("./product-status");
    await expect(updateStatus("p1", "scale", null)).rejects.toThrow("redirect:/admin/login");
  });

  it("updates status and status_note", async () => {
    requireAdmin.mockResolvedValue({ user: { role: "admin" } });
    const productId = await createTestProduct();
    try {
      const { updateStatus } = await import("./product-status");
      const result = await updateStatus(productId, "scale", "Conversion above threshold");
      expect(result).toBeUndefined();

      const row = await db.query.products.findFirst({ where: eq(products.id, productId) });
      expect(row?.status).toBe("scale");
      expect(row?.statusNote).toBe("Conversion above threshold");
    } finally {
      await db.delete(products).where(eq(products.id, productId));
    }
  });
});
