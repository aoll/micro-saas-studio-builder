import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

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
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));

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

  it("returns a form error and logs when the DAL rejects (e.g. assertEditable's lock), no tag update", async () => {
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
    // `updateStatus`'s row lock or `assertEditable` could throw; `unstable_rethrow` must let it
    // through unchanged, not treat it as a plain DAL failure (plan design "Errors").
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
});
