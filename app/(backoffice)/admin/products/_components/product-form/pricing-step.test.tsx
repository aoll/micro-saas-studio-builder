// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { estimateMargins } from "./margin";
import { PricingStep } from "./pricing-step";

afterEach(cleanup);

const pricing: ProductConfig["pricing"] = {
  freeCreditsOnSignup: 3,
  anonymousFreeGenerations: 1,
  costPerGeneration: 1,
  packs: [
    { id: "pack-10", credits: 10, priceCents: 490 },
    { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
  ],
};

function setup(overrides: Partial<React.ComponentProps<typeof PricingStep>> = {}) {
  const onChange = vi.fn();
  const props: React.ComponentProps<typeof PricingStep> = {
    pricing,
    margins: estimateMargins(pricing.packs, pricing.costPerGeneration, 4_000),
    costSource: "estimated",
    errors: {},
    onChange,
    ...overrides,
  };
  const view = render(<PricingStep {...props} />);
  return { onChange, ...view };
}

describe("PricingStep", () => {
  it("shows the current numbers", () => {
    setup();
    expect((screen.getByLabelText("Crédits offerts à l'inscription") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Générations anonymes gratuites") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Coût par génération (crédits)") as HTMLInputElement).value).toBe("1");
  });

  it("changes the cost per generation", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Coût par génération (crédits)"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ costPerGeneration: 2 });
  });

  it("shows the pack price in euros", () => {
    setup();
    const priceInputs = screen.getAllByLabelText(/Prix/);
    expect((priceInputs[0] as HTMLInputElement).value).toBe("4.9");
    expect((priceInputs[1] as HTMLInputElement).value).toBe("14.9");
  });

  it("edits a pack's price, converting euros back to cents", () => {
    const { onChange } = setup();
    const priceInputs = screen.getAllByLabelText(/Prix/);
    fireEvent.change(priceInputs[0]!, { target: { value: "5.90" } });
    expect(onChange).toHaveBeenCalledWith({
      packs: [
        { id: "pack-10", credits: 10, priceCents: 590 },
        { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
      ],
    });
  });

  it("adds a pack", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un pack" }));
    expect(onChange).toHaveBeenCalledWith({ packs: expect.arrayContaining([...pricing.packs, expect.anything()]) });
  });

  it("removes a pack", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer ce pack" })[0]!);
    expect(onChange).toHaveBeenCalledWith({ packs: [pricing.packs[1]] });
  });

  it("marks a pack as recommended", () => {
    const { onChange } = setup();
    const checkboxes = screen.getAllByLabelText("Recommandé");
    fireEvent.click(checkboxes[0]!);
    expect(onChange).toHaveBeenCalledWith({
      packs: [
        { id: "pack-10", credits: 10, priceCents: 490, recommended: true },
        { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
      ],
    });
  });

  it("shows the estimated margin per pack, labelled as an estimate", () => {
    setup();
    expect(screen.getByText(/estimé/i)).toBeTruthy();
  });

  it("shows the measured margin per pack, labelled as measured", () => {
    setup({ costSource: "measured" });
    expect(screen.getByText(/mesuré/i)).toBeTruthy();
  });

  it("shows a negative margin in red", () => {
    const negativeMargins = estimateMargins(pricing.packs, pricing.costPerGeneration, 600_000);
    setup({ margins: negativeMargins });
    const marginText = screen.getAllByTestId("pack-margin")[0]!;
    expect(marginText.className).toContain("text-destructive");
  });

  it("shows a pack error message", () => {
    setup({ errors: { "pricing.packs.0.id": "Identifiant de pack déjà utilisé" } });
    expect(screen.getByText("Identifiant de pack déjà utilisé")).toBeTruthy();
  });

  // QA1-P6-E3 (B-P6-1): four numeric paths of step 6 produced a French
  // message in `validation.ts` but were never wired to an `errors[…]` lookup
  // in this component, so the admin saw no message and no `aria-invalid`
  // while "Suivant" stayed blocked.
  it("shows the free credits on signup error message, with aria-invalid", () => {
    setup({ errors: { "pricing.freeCreditsOnSignup": "Minimum : 0" } });
    expect(screen.getByText("Minimum : 0")).toBeTruthy();
    expect(screen.getByLabelText("Crédits offerts à l'inscription").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the anonymous free generations error message, with aria-invalid", () => {
    setup({ errors: { "pricing.anonymousFreeGenerations": "Minimum : 0" } });
    expect(screen.getByText("Minimum : 0")).toBeTruthy();
    expect(screen.getByLabelText("Générations anonymes gratuites").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows a pack credits error message, with aria-invalid", () => {
    setup({ errors: { "pricing.packs.0.credits": "Doit être supérieur à 0" } });
    expect(screen.getByText("Doit être supérieur à 0")).toBeTruthy();
    expect(screen.getByLabelText("Crédits", { selector: "#pricing-pack-credits-0" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("shows a pack price error message, with aria-invalid", () => {
    setup({ errors: { "pricing.packs.0.priceCents": "Doit être supérieur à 0" } });
    expect(screen.getByText("Doit être supérieur à 0")).toBeTruthy();
    expect(screen.getByLabelText("Prix (€)", { selector: "#pricing-pack-price-0" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  // QA1-P6-E3: a pack with 0 credits divides by zero in `revenuePerGenerationMicros`.
  // The margin must show "—" instead of "$Infinity" or "$NaN".
  it("shows — for the margin of a pack with 0 credits, instead of $Infinity or NaN", () => {
    const zeroCreditPacks: ProductConfig["pricing"]["packs"] = [{ id: "pack-0", credits: 0, priceCents: 490 }];
    setup({
      pricing: { ...pricing, packs: zeroCreditPacks },
      margins: estimateMargins(zeroCreditPacks, pricing.costPerGeneration, 4_000),
    });
    const marginText = screen.getByTestId("pack-margin");
    expect(marginText.textContent).not.toContain("Infinity");
    expect(marginText.textContent).not.toContain("NaN");
    expect(marginText.textContent).toContain("—");
  });
});
