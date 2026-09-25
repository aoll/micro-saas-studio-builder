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
  // node_modules/next/dist/server/lib/generate-agent-files.js:
  // `writeAgentFiles` upserts into an *existing* AGENTS.md ahead of
  // CLAUDE.md (`agentsMdExists && (agentsMdHostsBlock || !claudeMdHostsBlock)`).
  // Seeding an empty AGENTS.md before running `next dev` once makes it
  // host the managed block, matching spec bullet 7 literally ("AGENTS.md
  // ... présents") and docs/10-tooling-dev.md / docs/04-nextjs.md, which
  // both point agents at AGENTS.md, not CLAUDE.md. Re-running `next dev`
  // confirmed it never re-adds the block to CLAUDE.md once AGENTS.md
  // hosts it.
  it("AGENTS.md exists and references the Next docs it is generated from", () => {
    expect(existsSync("AGENTS.md")).toBe(true);
    const agents = readFileSync("AGENTS.md", "utf8");
    expect(agents).toContain("<!-- BEGIN:nextjs-agent-rules -->");
    expect(agents).toMatch(/node_modules\/next\/dist\/docs/);
  });

  it("CLAUDE.md mentions AGENTS.md", () => {
    const claudeMd = readFileSync("CLAUDE.md", "utf8");
    expect(claudeMd).toContain("AGENTS.md");
    expect(claudeMd).not.toContain("<!-- BEGIN:nextjs-agent-rules -->");
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
