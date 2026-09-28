import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { SEED_OWNER } from "@/scripts/seed";
import frDecision from "@/messages/fr/backoffice-decision.json";
import enDecision from "@/messages/en/backoffice-decision.json";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

// I18N-BACKOFFICE-STRINGS (lot 3, Contract): every call order below records
// which mock ran first, so "checks admin before anything else" can assert
// getTranslations() never runs ahead of requireAdmin() — the spec's
// explicit ordering rule (require-admin-coverage.test.ts only scans
// page.tsx files, not _actions.ts, so this file is where that order is
// actually verified for setProductStatus).
const callOrder: string[] = [];

const requireAdmin = vi.fn();
vi.mock("@/lib/dal/session", () => ({
  requireAdmin: () => {
    callOrder.push("requireAdmin");
    return requireAdmin();
  },
}));

const messagesByLocale = { fr: frDecision, en: enDecision };
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: "backoffice-decision" }) => {
    callOrder.push("getTranslations");
    return createTranslator({ locale, messages: { "backoffice-decision": messagesByLocale[locale] }, namespace });
  },
}));

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
  callOrder.length = 0;
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
  it("checks admin before anything else, including before getTranslations", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { setProductStatus } = await import("./_actions");
    await expect(setProductStatus("my-product", "fr", {}, formDataFor({ status: "scale" }))).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(callOrder).toEqual(["requireAdmin"]);
  });

  it("calls getTranslations right after requireAdmin(), on the happy path", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });
    updateStatus.mockResolvedValue(undefined);
    const { setProductStatus } = await import("./_actions");

    await setProductStatus("my-product", "fr", {}, formDataFor({ status: "scale" }));
    expect(callOrder[0]).toBe("requireAdmin");
    expect(callOrder[1]).toBe("getTranslations");
  });

  // A Server Action is a public POST endpoint (CLAUDE.md): a tampered or
  // missing locale must never throw or crash the request, it degrades to
  // French — the same default i18n/request.ts's own backoffice branch uses
  // when the admin_locale cookie is missing or invalid.
  it("falls back to French error messages for a tampered/invalid locale, instead of throwing", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("Not A Slug", "de" as never, {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
  });

  it("returns a form error for an invalid slug, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("Not A Slug", "fr", {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns the invalid-slug error in English when the locale is en", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("Not A Slug", "en", {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Product not found");
  });

  it("returns a form error for an invalid status, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("my-product", "fr", {}, formDataFor({ status: "not-a-status" }));
    expect(result.formError).toBe("Statut invalide");
    expect(getProduct).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns the invalid-status error in English when the locale is en", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("my-product", "en", {}, formDataFor({ status: "not-a-status" }));
    expect(result.formError).toBe("Invalid status");
  });

  it("returns a form error for a note over 500 characters, without calling the DAL", async () => {
    currentAdmin();
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus(
      "my-product",
      "fr",
      {},
      formDataFor({ status: "scale", note: "a".repeat(501) }),
    );
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

    await setProductStatus("my-product", "fr", {}, formDataFor({ status: "learn", note: "  a note  " }));
    expect(updateStatus).toHaveBeenCalledWith(productId, "learn", "a note");

    updateStatus.mockClear();
    await setProductStatus("my-product", "fr", {}, formDataFor({ status: "learn", note: "   " }));
    expect(updateStatus).toHaveBeenCalledWith(productId, "learn", null);
  });

  it("returns a form error when the product is unknown, no tag update", async () => {
    currentAdmin();
    getProduct.mockResolvedValue(null);
    const { setProductStatus } = await import("./_actions");
    const result = await setProductStatus("missing-product", "fr", {}, formDataFor({ status: "scale" }));
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

    const result = await setProductStatus("my-product", "fr", {}, formDataFor({ status: "killed", note: "decision" }));
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

    const result = await setProductStatus("my-product", "fr", {}, formDataFor({ status: "killed" }));
    expect(result.formError).toBe("Le statut n'a pas pu être changé");
    expect(updateTag).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns the update-failed error in English when the locale is en", async () => {
    currentAdmin();
    const productId = randomUUID();
    getProduct.mockResolvedValue({ id: productId });
    updateStatus.mockRejectedValue(new Error("locked"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { setProductStatus } = await import("./_actions");

    const result = await setProductStatus("my-product", "en", {}, formDataFor({ status: "killed" }));
    expect(result.formError).toBe("Status could not be changed");
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

    await expect(setProductStatus("my-product", "fr", {}, formDataFor({ status: "killed" }))).rejects.toBe(
      redirectError,
    );
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
    const result = await setProductStatus(slug, "fr", {}, formDataFor({ status: "scale" }));
    expect(result.formError).toBe("Produit introuvable");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();

    await db.delete(products).where(eq(products.id, row!.id));
    vi.doMock("@/lib/dal/products", () => ({ getProduct: (s: string) => getProduct(s) }));
    vi.resetModules();
  });
});
