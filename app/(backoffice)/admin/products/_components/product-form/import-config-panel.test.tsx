// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-product-form-a.json";
import fr from "@/messages/fr/backoffice-product-form-a.json";
import type { Theme } from "@/lib/dal/themes";
import { ImportConfigPanel } from "./import-config-panel";

afterEach(cleanup);

const currentThemeId = "3f6a6a1e-6b0b-4e9a-8b1a-2f6a1a2b3c4d";

const themes: Theme[] = [
  {
    id: currentThemeId,
    slug: "editorial",
    name: "Editorial",
    tokens: {} as Theme["tokens"],
    landingVariant: "centered",
    isSeed: true,
  },
];

const bioInstagramFixture = readFileSync(join(process.cwd(), "fixtures/bio-instagram.config.json"), "utf-8");

// I18N-BACKOFFICE-STRINGS lot 4: ImportConfigPanel now reads its labels
// through useTranslations("backoffice-product-form-a"), so every render
// needs the zone's messages in context.
function setup(uiLocale: "fr" | "en" = "fr") {
  const onImport = vi.fn();
  const onErrors = vi.fn();
  const messages = uiLocale === "fr" ? fr : en;
  const view = render(
    <NextIntlClientProvider locale={uiLocale} messages={{ "backoffice-product-form-a": messages }}>
      <ImportConfigPanel themes={themes} currentThemeId={currentThemeId} onImport={onImport} onErrors={onErrors} />
    </NextIntlClientProvider>,
  );
  return { onImport, onErrors, ...view };
}

function paste(text: string, uiLocale: "fr" | "en" = "fr") {
  const pasteLabel = uiLocale === "fr" ? "Coller une configuration JSON" : "Paste a JSON configuration";
  const importLabel = uiLocale === "fr" ? "Importer" : "Import";
  fireEvent.change(screen.getByLabelText(pasteLabel), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: importLabel }));
}

describe("ImportConfigPanel", () => {
  it("shows a local error for malformed JSON, without calling onImport or onErrors", () => {
    const { onImport, onErrors } = setup();
    paste("not json");
    expect(screen.getByRole("alert").textContent).toBe("Configuration JSON illisible");
    expect(onImport).not.toHaveBeenCalled();
    expect(onErrors).not.toHaveBeenCalled();
  });

  it("calls onImport once with the parsed config on a valid paste", () => {
    const { onImport, onErrors } = setup();
    paste(bioInstagramFixture);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0]![0].themeId).toBe(currentThemeId);
    expect(onImport.mock.calls[0]![0].slug).toBe("bio-instagram");
    expect(onErrors).not.toHaveBeenCalled();
  });

  it("calls onErrors with the field errors for a structurally invalid config", () => {
    const invalid = {
      ...JSON.parse(bioInstagramFixture),
      landing: { ...JSON.parse(bioInstagramFixture).landing, headline: "" },
    };
    const { onImport, onErrors } = setup();
    paste(JSON.stringify(invalid));
    expect(onErrors).toHaveBeenCalledWith(expect.objectContaining({ "landing.headline": "Ce champ est requis" }));
    expect(onImport).not.toHaveBeenCalled();
  });

  // I18N-BACKOFFICE-STRINGS: catches a label left hardcoded in French once
  // the admin_locale cookie is "en" (spec acceptance: no French text leaks).
  it("renders the paste label, the button and the malformed-JSON error in English when the locale is en", () => {
    const { onImport, onErrors } = setup("en");
    expect(screen.getByLabelText("Paste a JSON configuration")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    paste("not json", "en");
    expect(screen.getByRole("alert").textContent).toBe("Unreadable JSON configuration");
    expect(onImport).not.toHaveBeenCalled();
    expect(onErrors).not.toHaveBeenCalled();
  });
});
