import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
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
vi.mock("@/lib/dal/session", () => ({ requireAdmin: () => requireAdmin() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const updateStatus = vi.fn();
vi.mock("@/lib/dal/product-status", () => ({ updateStatus: (...args: unknown[]) => updateStatus(...args) }));

const updateTag = vi.fn();
// cacheLife/cacheTag are no-ops here except for the QA2-P1-B1 real-getProduct test below, where
// the real (unmocked) getProduct's "use cache" needs a request-free stand-in (docs/09 test
// pattern, same as lib/dal/metrics.test.ts).
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTag(tag),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

afterEach(() => {
  requireAdmin.mockReset();
  getProduct.mockReset();
  updateStatus.mockReset();
  updateTag.mockReset();
});

function currentAdmin() {
  requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
}

function formDataFor({ status, note }: { status?: string; note?: string }): FormData {
  const data = new FormData();
  if (status !== undefined) data.set("status", status);
  if (note !== undefined) data.set("note", note);
  return data;
}

describe("setProductStatus", () => {
  it("checks admin before anything else", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { setProductStatus } = await import("./_actions");
    await expect(setProductStatus("my-product", {}, formDataFor({ status: "scale" }))).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("returns a form error for an invalid slug, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("Not A Slug", {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns a form error for an invalid status, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("my-product", {}, formDataFor({ status: "not-a-status" }));
    expect(result.formError).toBe("Statut invalide");
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns a form error for a note over 500 characters, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("my-product", {}, formDataFor({ status: "scale", note: "a".repeat(501) }));
    expect(result.formError).toBe("Note trop longue (500 caractères max)");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("trims the note and treats an empty note as null", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });
    updateStatus.mockResolvedValue(undefined);
    const { setProductStatus } = await import("./_actions");

    await setProductStatus("my-product", {}, formDataFor({ status: "learn", note: "  a note  " }));
    expect(updateStatus).toHaveBeenCalledWith(productId, "learn", "a note");

    updateStatus.mockClear();
    await setProductStatus("my-product", {}, formDataFor({ status: "learn", note: "   " }));
    expect(updateStatus).toHaveBeenCalledWith(productId, "learn", null);
  });

  it("returns a form error when the product is unknown, no tag update", async () => {
    currentAdmin();
    getProduct.mockResolvedValue(null);
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("missing-product", {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("on the happy path, calls updateStatus then tags product:{slug} and products, exactly twice", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });
    updateStatus.mockResolvedValue(undefined);
    const { setProductStatus } = await import("./_actions");

    const result = await setProductStatus("my-product", {}, formDataFor({ status: "killed", note: "decision" }));
    expect(result).toEqual({ ok: true });
    expect(updateStatus).toHaveBeenCalledWith(productId, "killed", "decision");
    expect(updateTag).toHaveBeenCalledWith("product:my-product");
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it("returns a form error and logs when the DAL rejects, no tag update", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });
    updateStatus.mockRejectedValue(new Error("locked"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { setProductStatus } = await import("./_actions");

    const result = await setProductStatus("my-product", {}, formDataFor({ status: "killed" }));
    expect(result.formError).toBe("Le statut n'a pas pu être changé");
    expect(updateTag).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("rethrows a Next redirect/notFound error from the DAL untouched: no formError, no log, no tags", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });

    // A real Next.js internal control-flow error (digest `NEXT_REDIRECT;...`), the kind
    // `updateStatus`'s row lock could throw; `unstable_rethrow` must let it through unchanged,
    // not treat it as a plain DAL failure (plan design "Errors").
    let redirectError: unknown;
    try {
      redirect("/admin/login");
    } catch (err) {
      redirectError = err;
    }
    updateStatus.mockRejectedValue(redirectError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { setProductStatus } = await import("./_actions");

    await expect(setProductStatus("my-product", {}, formDataFor({ status: "killed" }))).rejects.toBe(redirectError);
    expect(consoleError).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // QA2-P1-B1 code review (MEDIUM finding, specs/qa/QA2-P1-B1-brouillon-publie.md): every test
  // above mocks getProduct, so "returns a form error when the product is unknown" only proves
  // the action's own null-handling, not what the real getProduct(slug) — the same public,
  // cached DAL function this spec changed to return null for a never-published product
  // (current_version IS NULL) — actually does for one. This test uses the real getProduct and
  // a real inserted row instead (vi.doUnmock, mirrors lib/dal/products.test.ts's
  // insertNeverPublishedProduct()), to confirm end to end that the admin gets a clean form
  // error, not a silent success or a crash.
  it("returns a form error for a real never-published product (current_version IS NULL), via the real getProduct", async () => {
    currentAdmin();
    vi.doUnmock("@/lib/dal/products");
    vi.resetModules();

    const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    const slug = `bo06-never-published-${randomUUID()}`;
    const [row] = await db
      .insert(products)
      .values({ slug, themeId: editorial!.id, locale: "fr", createdBy: owner!.id })
      .returning({ id: products.id });

    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus(slug, {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();

    await db.delete(products).where(eq(products.id, row!.id));
    vi.doMock("@/lib/dal/products", () => ({ getProduct: (s: string) => getProduct(s) }));
    vi.resetModules();
  });
});
