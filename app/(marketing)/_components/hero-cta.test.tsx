// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroCta } from "./hero-cta";

afterEach(cleanup);

// The bug this guards: a plain `href="#produits"` only scrolls when the
// hash actually changes. Coming back from a product page (browser Back)
// restores the URL to `/#produits`, already unchanged — a second click was
// then a native no-op and the CTA looked dead.
describe("HeroCta", () => {
  it("scrolls to #produits on click even when the hash is already current", () => {
    const target = document.createElement("div");
    target.id = "produits";
    document.body.appendChild(target);
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    render(<HeroCta className="mk-cta">Voir un produit en direct</HeroCta>);
    fireEvent.click(screen.getByRole("link", { name: "Voir un produit en direct" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    target.remove();
  });
});
