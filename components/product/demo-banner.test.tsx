// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";

afterEach(() => {
  cleanup();
  vi.resetModules();
});

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("DemoBanner", () => {
  it("renders nothing when DEMO_MODE is false", async () => {
    vi.doMock("@/lib/env", () => ({ env: { DEMO_MODE: false } }));
    const { DemoBanner } = await import("./demo-banner");
    const { container } = renderUi(<DemoBanner />);
    expect(container.textContent).toBe("");
  });

  it("renders the 'Démo' text when DEMO_MODE is true", async () => {
    vi.doMock("@/lib/env", () => ({ env: { DEMO_MODE: true } }));
    const { DemoBanner } = await import("./demo-banner");
    renderUi(<DemoBanner />);
    expect(screen.getByText(/Démo/)).toBeTruthy();
  });
});
