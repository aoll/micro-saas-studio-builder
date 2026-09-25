import { describe, expect, it } from "vitest";
import { insertVariable } from "./prompt-variables";

describe("insertVariable", () => {
  it("inserts {{key}} at the caret when there is no selection", () => {
    const result = insertVariable("Bonjour ", 8, 8, "nom");
    expect(result).toEqual({ value: "Bonjour {{nom}}", caret: 15 });
  });

  it("replaces the selected text with {{key}}", () => {
    const result = insertVariable("Bonjour XXX !", 8, 11, "nom");
    expect(result).toEqual({ value: "Bonjour {{nom}} !", caret: 15 });
  });

  it("inserts at the start of an empty template", () => {
    const result = insertVariable("", 0, 0, "poste");
    expect(result).toEqual({ value: "{{poste}}", caret: 9 });
  });

  it("keeps the text after the caret intact", () => {
    const result = insertVariable("Salut !", 5, 5, "prenom");
    expect(result.value).toBe("Salut{{prenom}} !");
  });
});
