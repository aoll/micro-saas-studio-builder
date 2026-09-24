import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BO-01 bullet 3: every /admin page calls requireAdmin() itself (not only a
// shared layout), so a role=user session is redirected on every page, not
// just the ones a spec remembered to guard. This test is source-level (no
// glob: `(backoffice)` contains parentheses) and grows automatically as
// specs add pages under admin/**.
const adminDir = import.meta.dirname;

const pageFiles = readdirSync(adminDir, { recursive: true })
  .filter((entry): entry is string => typeof entry === "string" && entry.endsWith("page.tsx"))
  .sort();

const guardedPages = pageFiles.filter((file) => !file.startsWith(`login${"/"}`) && file !== "login/page.tsx");

describe("every /admin page calls requireAdmin()", () => {
  it("finds the admin pages", () => {
    expect(pageFiles.length).toBeGreaterThan(0);
    expect(guardedPages.length).toBeGreaterThan(0);
  });

  it.each(guardedPages)("%s imports and calls requireAdmin()", (file) => {
    const source = readFileSync(join(adminDir, file), "utf8");
    expect(source).toMatch(/from\s+["']@\/lib\/dal\/session["']/);
    expect(source).toMatch(/\brequireAdmin\b/);
    expect(source).toMatch(/await\s+requireAdmin\s*\(\s*\)/);
  });

  it("login/page.tsx never calls requireAdmin() (it must stay reachable without a session)", () => {
    const source = readFileSync(join(adminDir, "login/page.tsx"), "utf8");
    expect(source).not.toMatch(/requireAdmin/);
  });
});
