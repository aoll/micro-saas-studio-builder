import { expect, test } from "@playwright/test";

// The making-of at `/making-of`, reached from the recruiter landing's
// "Comment c'est construit" section. A static page: no seed data involved.
test.describe("Making-of (/making-of)", () => {
  test("is reachable from the landing and shows the run's timeline", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Voir le making-of" }).click();
    await expect(page).toHaveURL(/\/making-of$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("258 agents IA");
    await expect(page.getByRole("list", { name: "Worktrees du run" }).getByRole("listitem")).toHaveCount(59);
  });

  test("links back to the landing", async ({ page }) => {
    await page.goto("/making-of");
    await page.getByRole("link", { name: "Retour à la démo" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
