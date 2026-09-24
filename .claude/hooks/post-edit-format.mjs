#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): run eslint --fix and prettier --write on
// the edited file when the repo has them installed. Skips node_modules, .next
// and drizzle/ (generated migrations). Never fails the tool call: exits 0.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const FORMAT = /\.(ts|tsx|js|mjs|json|css|md)$/;
const LINT = /\.(ts|tsx|js|mjs)$/;
const SKIP = /(^|\/)(node_modules|\.next)\/|^drizzle\//;
const BUDGET_MS = 20000;

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  if (raw.length < 1024 * 1024) raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const filePath = JSON.parse(raw)?.tool_input?.file_path;
    if (typeof filePath !== "string" || !FORMAT.test(filePath)) return;
    const file = resolve(filePath);
    if (!existsSync(file)) return;
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dirname(file),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const rel = relative(root, file).split("\\").join("/");
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || SKIP.test(rel)) return;

    const deadline = Date.now() + BUDGET_MS;
    const runBin = (name, args) => {
      const bin = join(root, "node_modules", ".bin", name);
      const timeout = deadline - Date.now();
      if (!existsSync(bin) || timeout <= 0) return;
      try {
        execFileSync(bin, args, { cwd: root, stdio: "ignore", timeout });
      } catch {
        // lint errors that --fix cannot solve, or a timeout: not this hook's job
      }
    };
    // eslint first so prettier has the last word on formatting.
    if (LINT.test(rel)) runBin("eslint", ["--fix", rel]);
    runBin("prettier", ["--write", "--ignore-unknown", rel]);
  } catch {
    // fail safe
  }
});
process.stdin.on("close", () => setImmediate(() => process.exit(0)));
