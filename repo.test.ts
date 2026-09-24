import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

describe("package.json scripts", () => {
  it.each([
    ["typecheck", "typecheck"],
    ["test", "test"],
    ["test:coverage", "test"],
    ["test:e2e", "e2e"],
  ])("%s starts with scripts/queued.sh %s, never nested in a second queued.sh", (script, queue) => {
    const command = pkg.scripts[script]!;
    expect(command.startsWith(`scripts/queued.sh ${queue} `)).toBe(true);
    expect(command.match(/scripts\/queued\.sh/g)).toHaveLength(1);
  });

  it("chains typecheck, lint, format:check, knip and test in check", () => {
    expect(pkg.scripts.check).toBe("pnpm typecheck && pnpm lint && pnpm format:check && pnpm knip && pnpm test");
  });

  it("has db:migrate, db:seed, dev and prepare", () => {
    expect(pkg.scripts["db:migrate"]).toBe("drizzle-kit migrate");
    expect(pkg.scripts["db:seed"]).toBe("tsx scripts/seed.ts");
    expect(pkg.scripts.dev).toContain("next dev");
    expect(pkg.scripts.prepare).toBe("husky");
  });
});

describe("pre-commit hook", () => {
  it(".husky/pre-commit runs lint-staged", () => {
    const hook = readFileSync(".husky/pre-commit", "utf8");
    expect(hook).toContain("lint-staged");
  });

  it(".lintstagedrc.js runs eslint --fix and prettier --write on ts/tsx/js/mjs", () => {
    const config = readFileSync(".lintstagedrc.js", "utf8");
    expect(config).toContain("eslint --fix");
    expect(config).toContain("prettier --write");
  });
});

describe("agentic tooling files (bullet 7)", () => {
  // node_modules/next/dist/server/lib/generate-agent-files.js: `next dev`
  // only creates a *separate* AGENTS.md when neither AGENTS.md nor
  // CLAUDE.md exists yet. This repo already had CLAUDE.md before the
  // managed block existed, so Next upserts the block into CLAUDE.md
  // instead (`claudeMdHostsBlock`) and leaves AGENTS.md untouched.
  // Verified by running `next dev` once against this repo.
  it("CLAUDE.md is managed by Next and references the bundled docs", () => {
    expect(existsSync("AGENTS.md")).toBe(false);
    const claudeMd = readFileSync("CLAUDE.md", "utf8");
    expect(claudeMd).toContain("<!-- BEGIN:nextjs-agent-rules -->");
    expect(claudeMd).toMatch(/node_modules\/next\/dist\/docs/);
  });

  it(".mcp.json declares next-devtools-mcp", () => {
    const mcp = JSON.parse(readFileSync(".mcp.json", "utf8")) as {
      mcpServers: Record<string, { args?: string[] }>;
    };
    expect(mcp.mcpServers["next-devtools"]?.args?.join(" ")).toContain("next-devtools-mcp");
  });

  it("docs/README.md exists", () => {
    expect(existsSync("docs/README.md")).toBe(true);
  });
});
