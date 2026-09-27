// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-mock", className: "font-mock" });
  return { JetBrains_Mono: loader, IBM_Plex_Sans: loader };
});

afterEach(cleanup);

describe("MakingOffPage", () => {
  it("opens on the run's headline and key figures", async () => {
    const { default: MakingOffPage } = await import("./page");
    render(<MakingOffPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("258 agents IA");
    expect(screen.getByText("specs mergées")).toBeTruthy();
    expect(screen.getByText("constat restant")).toBeTruthy();
  });

  it("draws one timeline lane per worktree, with its times in a tooltip", async () => {
    const { default: MakingOffPage } = await import("./page");
    render(<MakingOffPage />);
    const timeline = screen.getByRole("list", { name: "Worktrees du run" });
    const lanes = within(timeline).getAllByRole("listitem");
    expect(lanes).toHaveLength(59);
    const [first] = lanes;
    if (!first) throw new Error("the timeline has no lane");
    expect(within(first).getByText("SETUP-SKELETON")).toBeTruthy();
    expect(first.querySelector("[title]")?.getAttribute("title")).toBe("SETUP-SKELETON · 22:24 → 23:33 · 10 agents");
  });

  it("offers the timeline as a table too", async () => {
    const { default: MakingOffPage } = await import("./page");
    render(<MakingOffPage />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(60);
  });

  it("shows every QA pass down to the one with no finding", async () => {
    const { default: MakingOffPage } = await import("./page");
    render(<MakingOffPage />);
    const passes = screen.getByRole("list", { name: "Constats par passe QA" });
    const items = within(passes).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items.at(0)?.textContent).toContain("22 constats");
    expect(items.at(-1)?.textContent).toContain("0 constat");
  });

  it("links back to the landing", async () => {
    const { default: MakingOffPage } = await import("./page");
    render(<MakingOffPage />);
    expect(screen.getByRole("link", { name: "Retour à la démo" }).getAttribute("href")).toBe("/");
  });
});
