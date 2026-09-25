// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frHistory from "@/messages/fr/history.json";
import enHistory from "@/messages/en/history.json";
import type { HistoryPage } from "@/lib/dal/history";

afterEach(cleanup);

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const listGenerations = vi.fn();
vi.mock("@/lib/dal/history", () => ({ listGenerations: (...args: unknown[]) => listGenerations(...args) }));

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => cookieGet(name) }) }));

// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set (see i18n/request.test.ts and the
// pricing page test): mocked with a real translator, and a formatter built
// from Intl directly (getFormatter has the same react-server export issue).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "history") =>
    createTranslator({ locale: "fr", messages: { history: frHistory }, namespace }),
  getFormatter: async () => ({
    dateTime: (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr", options).format(date),
  }),
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, history: frHistory }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const fields = [{ key: "poste", label: "Poste visé" }];

function searchParamsOf(page?: string) {
  return Promise.resolve(page === undefined ? {} : { page });
}

function emptyPage(page = 1): HistoryPage {
  return { entries: [], page, total: 0, hasMore: false };
}

describe("HistoryList — identity resolution", () => {
  afterEach(() => {
    getSession.mockReset();
    listGenerations.mockReset();
    cookieGet.mockReset();
  });

  it("uses the session's user id and never reads the anonymous_id cookie", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue(emptyPage());
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    expect(listGenerations).toHaveBeenCalledWith("user-1", "product-1", 1);
    expect(cookieGet).not.toHaveBeenCalled();
  });

  it("uses a valid anonymous_id cookie when there is no session", async () => {
    getSession.mockResolvedValue(null);
    cookieGet.mockReturnValue({ value: "550e8400-e29b-41d4-a716-446655440000" });
    listGenerations.mockResolvedValue(emptyPage());
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    expect(listGenerations).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000", "product-1", 1);
  });

  it("shows the empty state and never calls the DAL when there is no session and no cookie", async () => {
    getSession.mockResolvedValue(null);
    cookieGet.mockReturnValue(undefined);
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    expect(listGenerations).not.toHaveBeenCalled();
    expect(screen.getByText("Aucune génération pour le moment")).toBeTruthy();
  });

  it("shows the empty state and never calls the DAL when the cookie is a tampered, non-uuid value", async () => {
    getSession.mockResolvedValue(null);
    cookieGet.mockReturnValue({ value: "not-a-uuid" });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    expect(listGenerations).not.toHaveBeenCalled();
    expect(screen.getByText("Aucune génération pour le moment")).toBeTruthy();
  });
});

describe("HistoryList — page param", () => {
  afterEach(() => {
    getSession.mockReset();
    listGenerations.mockReset();
  });

  it.each([
    ["2", 2],
    ["abc", 1],
    ["0", 1],
    ["-3", 1],
    [undefined, 1],
  ])("parses %s as page %i", async (raw, expected) => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue(emptyPage(expected));
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(raw),
    });
    renderUi(ui);
    expect(listGenerations).toHaveBeenCalledWith("user-1", "product-1", expected);
  });
});

describe("HistoryList — rendering", () => {
  afterEach(() => {
    getSession.mockReset();
    listGenerations.mockReset();
  });

  it("renders the count, and each entry's summary, date and excerpt in DAL order", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue({
      entries: [
        {
          id: "gen-1",
          createdAt: new Date("2026-01-02T10:00:00.000Z"),
          input: { poste: "Développeur" },
          output: "Bonjour, voici votre lettre complète et détaillée.",
        },
        {
          id: "gen-2",
          createdAt: new Date("2026-01-01T09:00:00.000Z"),
          input: { poste: "Designer" },
          output: "Deuxième lettre.",
        },
      ],
      page: 1,
      total: 2,
      hasMore: false,
    });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);

    expect(screen.getByText("2 générations")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Poste visé : Développeur");
    expect(items[1]!.textContent).toContain("Poste visé : Designer");
  });

  it("shows the full result inside the opened details, and ResultCard renders it for copy", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    const fullText = "Texte complet du résultat, plus long que l'extrait affiché en résumé.";
    listGenerations.mockResolvedValue({
      entries: [{ id: "gen-1", createdAt: new Date("2026-01-02T10:00:00.000Z"), input: {}, output: fullText }],
      page: 1,
      total: 1,
      hasMore: false,
    });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    const { container } = renderUi(ui);

    const details = container.querySelector("details")!;
    details.open = true;
    expect(details.textContent).toContain(fullText);
  });

  it("shows the empty state with a link to the tool when total is 0", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue(emptyPage());
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    const link = screen.getByRole("link", { name: "Aller à l'outil" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/tool");
  });

  it("shows a 'more' link on page 1 when hasMore is true, no 'newer' link", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue({
      entries: [{ id: "gen-1", createdAt: new Date(), input: {}, output: "x" }],
      page: 1,
      total: 21,
      hasMore: true,
    });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf(),
    });
    renderUi(ui);
    const more = screen.getByRole("link", { name: "Générations plus anciennes" }) as HTMLAnchorElement;
    expect(more.getAttribute("href")).toBe("/lettre-pro/history?page=2");
    expect(screen.queryByRole("link", { name: "Générations plus récentes" })).toBeNull();
  });

  it("shows a 'newer' link on page 2, no 'more' link once past the last page", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue({
      entries: [{ id: "gen-1", createdAt: new Date(), input: {}, output: "x" }],
      page: 2,
      total: 21,
      hasMore: false,
    });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf("2"),
    });
    renderUi(ui);
    const newer = screen.getByRole("link", { name: "Générations plus récentes" }) as HTMLAnchorElement;
    expect(newer.getAttribute("href")).toBe("/lettre-pro/history?page=1");
    expect(screen.queryByRole("link", { name: "Générations plus anciennes" })).toBeNull();
  });

  it("shows a page-empty state with a link back to page 1 when past the last page", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    listGenerations.mockResolvedValue({ entries: [], page: 5, total: 21, hasMore: false });
    const { HistoryList } = await import("./history-list");
    const ui = await HistoryList({
      slug: "lettre-pro",
      productId: "product-1",
      fields,
      searchParams: searchParamsOf("5"),
    });
    renderUi(ui);
    const link = screen.getByRole("link", { name: "Revenir à la première page" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/history");
  });
});

describe("history.json — fr/en key parity", () => {
  function keyPaths(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
  }

  it("has identical key paths in fr and en", () => {
    expect(keyPaths(frHistory).sort()).toEqual(keyPaths(enHistory).sort());
  });
});
