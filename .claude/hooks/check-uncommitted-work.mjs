#!/usr/bin/env node
// Stop: warn on stderr when the current branch has uncommitted files or
// commits that exist on no remote. A reset container destroys such work with
// no trace in git history, even when the tests were green. Never blocks.

import { execFileSync } from "node:child_process";

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
  } catch {
    return null;
  }
};

try {
  if (git(["rev-parse", "--is-inside-work-tree"]) === "true") {
    const branch = git(["branch", "--show-current"]) || "(detached)";
    // --porcelain also lists untracked files, which `git diff` misses.
    const files = (git(["status", "--porcelain"]) ?? "").split("\n").filter(Boolean);
    // Commits reachable from HEAD but from no remote ref: robust even when the
    // upstream is missing or wrongly points at the integration branch.
    const unpushed = Number(git(["rev-list", "--count", "HEAD", "--not", "--remotes"]) ?? 0);

    const problems = [];
    if (files.length > 0) problems.push(`${files.length} uncommitted file(s)`);
    if (unpushed > 0) problems.push(`${unpushed} unpushed commit(s)`);
    if (problems.length > 0) {
      const lines = [`[stop] ${problems.join(" and ")} on branch ${branch}.`];
      for (const f of files.slice(0, 10)) lines.push(`[stop]   ${f}`);
      if (files.length > 10) lines.push(`[stop]   ... and ${files.length - 10} more`);
      lines.push("[stop] If this work is done: commit and push now. Green tests do not make it safe.");
      process.stderr.write(lines.join("\n") + "\n");
    }
  }
} catch {
  // fail safe
}
process.exit(0);
