#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): block edits to lint, format, type and
// test configuration. Agents must fix the code, not the checks. Creating a
// file that does not exist yet is allowed (scaffolding).
// Override for a human-approved change: ALLOW_CONFIG_EDIT=1. Exit 2 blocks.

import { lstatSync } from "node:fs";
import { basename, resolve } from "node:path";

const PROTECTED_NAMES = [
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.prettierrc/,
  /^prettier\.config\./,
  /^tsconfig.*\.json$/,
  /^knip\./,
  /^vitest\.config\./,
  /^playwright\.config\./,
  /^commitlint\.config\./,
  /^\.lintstagedrc/,
];
const PROTECTED_DIRS = /(^|\/)\.husky\//;

const isProtected = (filePath) => {
  const normalized = filePath.split("\\").join("/");
  if (/(^|\/)node_modules\//.test(normalized)) return false;
  // Case-insensitive: on macOS `TSConfig.json` is the same file as `tsconfig.json`.
  const name = basename(normalized).toLowerCase();
  return PROTECTED_NAMES.some((re) => re.test(name)) || PROTECTED_DIRS.test(normalized.toLowerCase());
};

const exists = (filePath) => {
  try {
    lstatSync(resolve(filePath));
    return true;
  } catch (err) {
    // Only a genuine "not found" counts as absent; any other error fails closed.
    return err?.code !== "ENOENT";
  }
};

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  if (process.env.ALLOW_CONFIG_EDIT === "1") process.exit(0);
  let filePath = "";
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path ?? "";
  } catch {
    process.exit(0);
  }
  if (typeof filePath !== "string" || !filePath || !isProtected(filePath) || !exists(filePath)) process.exit(0);
  process.stderr.write(
    `BLOCKED: ${filePath} is a protected lint/format/type/test config file.\n` +
      "Agents must fix the code, not the checks. A human edits these files " +
      "(or runs Claude with ALLOW_CONFIG_EDIT=1 for an approved change).\n",
  );
  process.exit(2);
});
