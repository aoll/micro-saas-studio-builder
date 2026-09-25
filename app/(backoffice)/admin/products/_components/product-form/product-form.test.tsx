// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import { newProductDraft } from "./form-values";

const bioInstagramFixture = readFileSync(join(process.cwd(), "fixtures/bio-instagram.config.json"), "utf-8");

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

  // QA1-P2-S1 (specs/qa/QA1-P2-S1-slug-pris.md): the slug's format is valid
  // ("lettre-pro" is a well-formed, non-reserved slug per slugSchema), so
  // `validateStep`'s local Zod check alone lets Suivant through. Only
  // `checkSlug`'s async availability check (the DB) knows it's taken, and
  // Suivant must wait for (or re-run) that check instead of racing it.
  it("blocks Suivant on a slug that's already taken, even though its format is valid", async () => {
    checkSlug.mockResolvedValue({ available: false, error: "Ce slug est déjà utilisé" });
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "LettrePro bis" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "lettre-pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await screen.findByText("Ce slug est déjà utilisé");
    expect(screen.getByRole("button", { name: /1\. Identité/ }).getAttribute("aria-current")).toBe("step");
  });

  // Code review (HIGH, run v1): `checkSlug` is a Server Action — it can
  // reject (network, an expired session inside `requireAdmin()`, a DB
  // error), and an unguarded `await` in a click handler would leave that
  // rejection unhandled with nothing shown to the admin. `handleNext` must
  // catch it, show a French, actionable message under Slug, and never
  // advance.
  it("shows an error and stays on step 1 if checkSlug rejects (network, expired session…)", async () => {
    checkSlug.mockRejectedValue(new Error("network error"));
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "LettrePro bis" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "lettre-pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await screen.findByText(/Impossible de vérifier la disponibilité du slug/);
    expect(screen.getByRole("button", { name: /1\. Identité/ }).getAttribute("aria-current")).toBe("step");
  });

  // Code review (MEDIUM, run v1): while the availability check is in
  // flight, Suivant must be disabled (like Enregistrer's `disabled={pending}`)
  // so a second click during the same check never fires a second request
  // nor a second (possibly racing) state update.
  it("disables Suivant while checking the slug's availability, and a second click has no effect", async () => {
    let resolveCheck!: (result: { available: boolean; error?: string }) => void;
    checkSlug.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "LettrePro bis" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "lettre-pro" } });
    // The keystroke above already fired its own (unrelated) checkSlug call
    // via handleIdentityChange; only Suivant's own call matters here.
    const callsBeforeNext = checkSlug.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));

    const pendingButton = (await screen.findByRole("button", { name: "Vérification…" })) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    fireEvent.click(pendingButton); // second click while still pending
    expect(checkSlug.mock.calls.length).toBe(callsBeforeNext + 1); // no extra call

    resolveCheck({ available: true });
    await screen.findByRole("button", { name: "Suivant" });
    expect(screen.getByRole("button", { name: /2\. Thème/ }).getAttribute("aria-current")).toBe("step");
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
    // Root cause of the flake this test hit under machine load, twice now
    // (once bare, once still after wrapping the confirmation-text `waitFor`
    // in `act()`): React 19's `useActionState` only rebinds its internal
    // action (here `publish.bind(null, publishSlug)`, see product-form.tsx)
    // through a *passive effect* (`actionStateActionEffect` in react-dom),
    // scheduled by the render that derives `createdSlug` — not
    // synchronously during that render. The confirmation text becomes true
    // as soon as that render *commits*, strictly before the passive effect
    // that does the rebind has necessarily run. The previous fix wrapped
    // `waitFor(() => screen.getByText(...))` in `act()`, but `waitFor`
    // (`@testing-library/dom`, same global config as `@testing-library/react`)
    // itself sets `IS_REACT_ACT_ENVIRONMENT` to `false` for the duration of
    // its own poll (its `asyncWrapper`, restored only in a `finally`) —
    // *even while already inside an outer `act()` scope*. Under enough
    // load, the rebinding passive effect can still be pending when that
    // inner poll's brief environment-restoring window closes, leaving its
    // completion unsynchronized with the outer `act()`'s own flush.
    //
    // Fix: never call an act-disabling API (`waitFor`, `findBy*`) inside the
    // `act()` scope. Instead, await the exact promise React itself is
    // awaiting — the one `publish`'s mock returned for this call, captured
    // from `mock.results` — directly inside `act()`. This is the pattern
    // React's own docs use for async actions: `act()` keeps flushing every
    // render and passive effect this resolution triggers (the rebind
    // included) until nothing is pending, with the act environment left
    // untouched throughout.
    const firstPublishCall = publish.mock.results[0]!.value as Promise<unknown>;
    await act(async () => {
      await firstPublishCall;
    });
    expect(screen.getByText(/Produit publié/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1]![0]).toBe("bio-instagram");
  });
});

// QA1-P1-M1 (specs/qa/QA1-P1-M1-config-complete.md): pasting a ready
// config on step 1 fills every step, validated by the same shared schema.
// `productConfigSchema` requires a real uuid `themeId` (unlike the rest of
// this file's `"theme-editorial"` fixture id, never itself schema-checked
// outside a save/publish action's mocked response), so importing needs a
// theme list whose id actually validates.
describe("ProductForm · import a pasted config", () => {
  const importThemeId = "3f6a6a1e-6b0b-4e9a-8b1a-2f6a1a2b3c4d";
  const importThemeOptions: Theme[] = [{ ...themeOptions[0]!, id: importThemeId }];

  it("shows the import panel on step 1 in create mode", () => {
    render(
      <ProductForm mode="create" slug={null} initialDraft={newProductDraft("theme-editorial")} themes={themeOptions} />,
    );
    expect(screen.getByLabelText("Coller une configuration JSON")).toBeTruthy();
  });

  it("does not show the import panel in edit mode", () => {
    render(
      <ProductForm
        mode="edit"
        slug="lettre-pro"
        initialDraft={{ ...newProductDraft("theme-editorial"), slug: "lettre-pro" }}
        themes={themeOptions}
      />,
    );
    expect(screen.queryByLabelText("Coller une configuration JSON")).toBeNull();
  });

  it("fills every step from a pasted config, with no error badge, theme kept (fallback)", async () => {
    render(
      <ProductForm
        mode="create"
        slug={null}
        initialDraft={newProductDraft(importThemeId)}
        themes={importThemeOptions}
      />,
    );
    fireEvent.change(screen.getByLabelText("Coller une configuration JSON"), {
      target: { value: bioInstagramFixture },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    await act(() => Promise.resolve());

    goToStep(3);
    expect(screen.getByLabelText("Exemple de résultat")).toHaveProperty(
      "value",
      expect.stringContaining("Coffee-first"),
    );
    expect(screen.getByText("Tell us your niche")).toBeTruthy();

    goToStep(5);
    expect(screen.getByLabelText("Prompt système")).toHaveProperty(
      "value",
      expect.stringContaining("social media copywriter"),
    );

    // fixture has no themeId: the mocked single theme is kept (fallback).
    goToStep(2);
    const themeGroup = screen.getByRole("radiogroup", { name: "Thème" });
    const checkedTheme = Array.from(themeGroup.querySelectorAll('[role="radio"]')).find(
      (option) => option.getAttribute("aria-checked") === "true",
    );
    expect(checkedTheme?.textContent).toContain("Editorial");

    expect(checkSlug).toHaveBeenCalledWith("bio-instagram");

    for (const step of [1, 2, 3, 4, 5, 6, 7]) {
      goToStep(step);
      const nav = screen.getByRole("button", { name: new RegExp(`^${step}\\.`) });
      expect(nav.getAttribute("data-has-error")).toBeNull();
    }
  });

  it("surfaces per-step errors from an invalid pasted config, without a separate error UI", () => {
    render(
      <ProductForm
        mode="create"
        slug={null}
        initialDraft={newProductDraft(importThemeId)}
        themes={importThemeOptions}
      />,
    );
    const invalid = {
      ...JSON.parse(bioInstagramFixture),
      landing: { ...JSON.parse(bioInstagramFixture).landing, headline: "" },
    };
    fireEvent.change(screen.getByLabelText("Coller une configuration JSON"), {
      target: { value: JSON.stringify(invalid) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));

    goToStep(3);
    expect(screen.getByText("Ce champ est requis")).toBeTruthy();
    expect(screen.getByRole("button", { name: /3\. Landing/ }).getAttribute("data-has-error")).toBe("true");
  });
});
