// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import { newProductDraft } from "./form-values";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const {
  saveProduct,
  checkSlug,
  uploadLogo,
  testPrompt,
  estimateGenerationCost,
  publish,
  replace,
  refresh,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  saveProduct: vi.fn(),
  checkSlug: vi.fn(),
  uploadLogo: vi.fn(),
  testPrompt: vi.fn(),
  estimateGenerationCost: vi.fn(),
  publish: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// BO-05b (specs/BO-05b-generation-publication.md): extends BO-05a's
// committed mock with the three new actions its steps 5-7 call, without
// touching a single assertion below (CLAUDE.md: a committed test is never
// weakened silently — this commit only adds mock entries).
vi.mock("../../_actions", () => ({ saveProduct, checkSlug, uploadLogo, testPrompt, estimateGenerationCost, publish }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ProductForm } = await import("./product-form");

// checkSlug is called imperatively (not through useActionState) whenever
// the slug field changes in create mode, and estimateGenerationCost runs
// on mount to feed step 6's margin panel (BO-05b): give both a resolved
// default so a test that only cares about another behaviour does not leave
// a dangling, unhandled rejection/`.then()` on `undefined`.
beforeEach(() => {
  checkSlug.mockResolvedValue({ available: true });
  estimateGenerationCost.mockResolvedValue({ costMicros: 4_000 });
});

afterEach(() => {
  cleanup();
  saveProduct.mockReset();
  checkSlug.mockReset();
  uploadLogo.mockReset();
  testPrompt.mockReset();
  estimateGenerationCost.mockReset();
  publish.mockReset();
  replace.mockClear();
  refresh.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
});

const tokens: ThemeTokens = {
  light: {
    background: "#faf7f2",
    foreground: "#2b2620",
    card: "#ffffff",
    cardForeground: "#2b2620",
    primary: "#8a5a34",
    primaryForeground: "#ffffff",
    secondary: "#efe7da",
    secondaryForeground: "#2b2620",
    muted: "#efe7da",
    mutedForeground: "#6b6357",
    accent: "#cbb994",
    accentForeground: "#2b2620",
    destructive: "#b3261e",
    border: "#e3dccb",
    input: "#e3dccb",
    ring: "#8a5a34",
  },
  dark: {
    background: "#1c1712",
    foreground: "#f4efe4",
    card: "#251f18",
    cardForeground: "#f4efe4",
    primary: "#c98f5e",
    primaryForeground: "#1c1712",
    secondary: "#332a20",
    secondaryForeground: "#f4efe4",
    muted: "#332a20",
    mutedForeground: "#b3a891",
    accent: "#8a5a34",
    accentForeground: "#f4efe4",
    destructive: "#ff6961",
    border: "#3a3025",
    input: "#3a3025",
    ring: "#c98f5e",
  },
  fontKey: "serif",
  radius: "0.5rem",
};

const themeOptions: Theme[] = [
  { id: "theme-editorial", slug: "editorial", name: "Editorial", tokens, landingVariant: "centered", isSeed: true },
];

function goToStep(step: number) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${step}\\.`) }));
}

describe("ProductForm", () => {
  it("starts on step 1 and blocks Suivant on an invalid slug", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Ce slug est réservé")).toBeTruthy();
    expect(screen.getByLabelText("Nom")).toBeTruthy(); // still on step 1
  });

  it("switches steps freely through the step nav", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    goToStep(3);
    expect(screen.getByLabelText("Titre")).toBeTruthy();
  });

  it("keeps values from a hidden step after navigating away and back", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Mon produit" } });
    goToStep(2);
    goToStep(1);
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Mon produit");
  });

  it("checks the slug's availability while typing in create mode", async () => {
    checkSlug.mockResolvedValue({ available: false, error: "Ce slug est déjà utilisé" });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "lettre-pro" } });
    await act(() => Promise.resolve());
    expect(checkSlug).toHaveBeenCalledWith("lettre-pro");
    await screen.findByText("Ce slug est déjà utilisé");
  });

  it("posts the cleaned config as JSON and shows success on save", async () => {
    saveProduct.mockResolvedValue({ ok: true, slug: "generateur-de-bio", version: 1 });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Générateur de bio" } });
    goToStep(4);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveProduct).toHaveBeenCalled());
    const [boundSlug, , formData] = saveProduct.mock.calls[0]!;
    expect(boundSlug).toBeNull();
    const posted = JSON.parse((formData as FormData).get("config") as string);
    expect(posted.name).toBe("Générateur de bio");
    expect(posted.slug).toBe("generateur-de-bio");

    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Brouillon enregistré · version 1"));
    expect(replace).toHaveBeenCalledWith("/admin/products/generateur-de-bio/edit");
  });

  it("does not redirect on save in edit mode", async () => {
    saveProduct.mockResolvedValue({ ok: true, slug: "lettre-pro", version: 3 });
    render(
      <ProductForm
        mode="edit"
        slug="lettre-pro"
        initialDraft={{ ...newProductDraft("theme-editorial"), slug: "lettre-pro" }}
        themes={themeOptions}
      />,
    );
    goToStep(4);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches to the errored step and shows the error returned by the action", async () => {
    saveProduct.mockResolvedValue({ errors: { slug: "Ce slug est déjà utilisé" }, step: 1 });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    goToStep(4);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Ce slug est déjà utilisé");
    expect(screen.getByLabelText("Slug")).toBeTruthy(); // back on step 1
  });

  it("disables the save button when read-only", () => {
    render(
      <ProductForm
        mode="edit"
        slug="lettre-pro"
        initialDraft={{ ...newProductDraft("theme-editorial"), slug: "lettre-pro" }}
        themes={themeOptions}
        readOnly
      />,
    );
    goToStep(4);
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// BO-05b (specs/BO-05b-generation-publication.md): steps 5-7.
describe("ProductForm · generation, pricing, publication", () => {
  it("lists all 7 steps, including Génération, Pricing and Récapitulatif", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    expect(screen.getByText(/5\. Génération/)).toBeTruthy();
    expect(screen.getByText(/6\. Pricing/)).toBeTruthy();
    expect(screen.getByText(/7\. Récapitulatif/)).toBeTruthy();
  });

  it("keeps Enregistrer available on step 1 already, not only on the last step", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
  });

  it("Enregistrer comes before Publier in DOM order (Enter submits a draft save, never a publish)", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    goToStep(7);
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.indexOf("Enregistrer")).toBeLessThan(buttons.indexOf("Publier"));
  });

  it("step 5 blocks Suivant on a {{variable}} without a matching field", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    goToStep(5);
    fireEvent.change(screen.getByLabelText("Template de prompt"), { target: { value: "Pour {{inconnu}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByRole("button", { name: /5\. Génération/ }).getAttribute("aria-current")).toBe("step");
  });

  it("a server error on step 6 (from Enregistrer) switches to the Pricing step", async () => {
    saveProduct.mockResolvedValue({ errors: { "pricing.costPerGeneration": "1 minimum" }, step: 6 });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByLabelText("Coût par génération (crédits)");
  });

  it("disables Publier when read-only", () => {
    render(
      <ProductForm
        mode="edit"
        slug="lettre-pro"
        initialDraft={{ ...newProductDraft("theme-editorial"), slug: "lettre-pro" }}
        themes={themeOptions}
        readOnly
      />,
    );
    goToStep(7);
    expect((screen.getByRole("button", { name: "Publier" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a create-mode publish captures the created slug, so a second publish takes the edit path", async () => {
    publish.mockResolvedValueOnce({ ok: true, slug: "bio-instagram", version: 1, url: "/bio-instagram" });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    goToStep(7);
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(publish.mock.calls[0]![0]).toBeNull();

    publish.mockResolvedValueOnce({ ok: true, slug: "bio-instagram", version: 2, url: "/bio-instagram" });
    await waitFor(() => screen.getByText(/Produit publié/));
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1]![0]).toBe("bio-instagram");
  });
});
