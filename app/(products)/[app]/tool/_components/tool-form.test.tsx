// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/tool.json";
import fr from "@/messages/fr/tool.json";
import common from "@/messages/fr/common.json";
import { BalanceBadge, BalanceProvider } from "@/components/product/balance";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { ToolForm } from "./tool-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
  refresh.mockClear();
  vi.unstubAllGlobals();
});

type Field = ProductConfig["inputs"][number];

const lettreProFields: Field[] = [
  { key: "poste", label: "Poste visé", type: "text", required: true },
  { key: "entreprise", label: "Entreprise", type: "text", required: true },
  { key: "experience", label: "Votre expérience", type: "textarea", required: true },
  { key: "ton", label: "Ton", type: "select", required: true, options: ["formel", "dynamique"] },
];

function sseBody(deltas: string[], extra: string[] = []): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = [
    ...deltas.map((delta) => `data: ${JSON.stringify({ type: "text-delta", id: "1", delta })}\n\n`),
    ...extra,
    "data: [DONE]\n\n",
  ];
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

function renderForm(props: Partial<React.ComponentProps<typeof ToolForm>> = {}, balance = 3) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common, tool: fr }}>
      <BalanceProvider>
        <BalanceBadge balance={balance} />
        <ToolForm slug="lettre-pro" inputs={lettreProFields} costPerGeneration={1} {...props} />
      </BalanceProvider>
    </NextIntlClientProvider>,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Poste visé"), { target: { value: "Développeur Frontend" } });
  fireEvent.change(screen.getByLabelText("Entreprise"), { target: { value: "Dotworld" } });
  fireEvent.change(screen.getByLabelText("Votre expérience"), { target: { value: "3 ans en React" } });
  fireEvent.change(screen.getByLabelText("Ton"), { target: { value: "dynamique" } });
}

describe("ToolForm — rendering and client-side validation", () => {
  it("renders one field per config.inputs entry and the cost-aware submit button", () => {
    renderForm();
    expect(screen.getByLabelText("Poste visé")).toBeTruthy();
    expect(screen.getByLabelText("Entreprise")).toBeTruthy();
    expect(screen.getByLabelText("Votre expérience")).toBeTruthy();
    expect(screen.getByLabelText("Ton")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Générer · 1 crédit" })).toBeTruthy();
  });

  it("blocks submission and shows a translated error when a required field is empty, without calling fetch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText("Entreprise"), { target: { value: "Dotworld" } });
    fireEvent.change(screen.getByLabelText("Votre expérience"), { target: { value: "3 ans" } });
    fireEvent.change(screen.getByLabelText("Ton"), { target: { value: "dynamique" } });
    // A real click on the button (not fireEvent.submit, which skips native
    // constraint validation): with `noValidate`, the browser's own tooltip
    // never pre-empts ToolForm's translated message (QA1 B9).
    expect(container.querySelector("form")!.noValidate).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));

    expect(screen.getByText("Ce champ est obligatoire.")).toBeTruthy();
    const posteInput = screen.getByLabelText("Poste visé") as HTMLInputElement;
    expect(posteInput.getAttribute("aria-invalid")).toBe("true");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("ToolForm — submit, stream and optimistic balance", () => {
  it("streams the result into the result card and decrements the balance badge while streaming", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(sseBody(["Bonjour", " le monde"]), {
        status: 200,
        headers: { "x-generation-id": "gen-1" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderForm({}, 3);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));

    await screen.findByText("2 crédits");
    await screen.findByText("Bonjour le monde");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).input.poste).toBe("Développeur Frontend");

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    await screen.findByText("3 crédits");
  });

  it("does not fire a second fetch on a double click", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(sseBody(["x"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    renderForm();
    fillValidForm();
    const button = screen.getByRole("button", { name: "Générer · 1 crédit" });
    fireEvent.click(button);
    fireEvent.click(button);
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });

  it("uses a new idempotency key for each submit", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(sseBody(["x"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await screen.findByText("x");

    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    const firstKey = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string).idempotencyKey;
    const secondKey = JSON.parse((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string).idempotencyKey;
    expect(firstKey).not.toBe(secondKey);
  });
});

describe("ToolForm — status branches", () => {
  it("redirects to /pricing on 402", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 402 })));
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/lettre-pro/pricing"));
  });

  it("redirects to /signup on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/lettre-pro/signup"));
  });

  it("redirects to /signup after the last free generation (x-free-generations-left: 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(sseBody(["Bonjour"]), { status: 200, headers: { "x-free-generations-left": "0" } }),
        ),
    );
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("Bonjour");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/lettre-pro/signup"));
  });

  it("shows a translated, remboursed error and a retry button on a stream error chunk", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            sseBody(["partiel"], [`data: ${JSON.stringify({ type: "error", errorText: "generation_failed" })}\n\n`]),
            { status: 200, headers: { "x-generation-id": "gen-1" } },
          ),
        ),
    );
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("La génération a échoué. Votre crédit a été remboursé.");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });

  it("shows the free-try message for an anonymous generation failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            sseBody([], [`data: ${JSON.stringify({ type: "error", errorText: "generation_failed" })}\n\n`]),
            { status: 200, headers: { "x-free-generations-left": "0" } },
          ),
        ),
    );
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("La génération a échoué. Votre essai gratuit reste disponible.");
  });

  it.each([
    [429, "Trop de générations en peu de temps, réessayez dans un instant."],
    [403, "Requête bloquée."],
    [409, "Cette génération a déjà été traitée."],
    [500, "Une erreur inattendue est survenue."],
  ])("shows a translated message for a %d response", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(message);
  });

  it("shows field errors returned by a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "invalid_input", fieldErrors: { poste: "too_long" } }, { status: 400 }),
        ),
    );
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("Ce champ est trop long.");
  });

  it("shows an unexpected error and logs it when fetch itself rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("Une erreur inattendue est survenue.");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("ToolForm — result card wiring", () => {
  it("names the result file '<slug>-<generationId>'", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(sseBody(["Bonjour"]), { status: 200, headers: { "x-generation-id": "gen-42" } }),
        ),
    );
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("Bonjour");
    const link = screen.getByRole("link", { name: "Télécharger" }) as HTMLAnchorElement;
    expect(link.download).toBe("lettre-pro-gen-42.md");
  });

  it("regenerate resubmits the same input with a new idempotency key", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(sseBody(["Bonjour"]), { status: 200, headers: { "x-generation-id": "gen-1" } }));
    vi.stubGlobal("fetch", fetchSpy);
    renderForm();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Générer · 1 crédit" }));
    await screen.findByText("Bonjour");

    fireEvent.click(screen.getByRole("button", { name: "Régénérer" }));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    const firstBody = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    const secondBody = JSON.parse((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(secondBody.input).toEqual(firstBody.input);
    expect(secondBody.idempotencyKey).not.toBe(firstBody.idempotencyKey);
  });
});

describe("tool.json — fr/en key parity", () => {
  function keyPaths(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
  }

  it("has identical key paths in fr and en", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });
});
