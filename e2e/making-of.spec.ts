import { expect, test } from "@playwright/test";

// The making-of at `/making-of`, reached from three links of the recruiter
// landing: the hero, "Comment c'est construit" and the footer. Following
// each link is what proves it works; no unit test reads their `href`.
// A static page: no seed data involved.
test.describe("Making-of (/making-of)", () => {
  test("shows every worktree of the run on the timeline", async ({ page }) => {
    await page.goto("/making-of");
    await expect(page.getByRole("list", { name: "Worktrees du run" }).getByRole("listitem")).toHaveCount(59);
  });

  for (const name of ["Découvrir le making-of", "Voir le making-of", "Making-of"]) {
    test(`the landing's "${name}" link opens the making-of`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(/\/making-of$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("258 agents IA");
    });
  }

  test("links back to the landing", async ({ page }) => {
    await page.goto("/making-of");
    await page.getByRole("link", { name: "Retour à la démo" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
