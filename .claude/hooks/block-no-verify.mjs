#!/usr/bin/env node
// PreToolUse (Bash): block git commands that skip the git hooks (--no-verify,
// `commit -n`, `-c core.hooksPath=`) and force pushes that can rewrite
// main/master. On feature branches only --force-with-lease is allowed.
// Exit 2 blocks with a message on stderr; anything unparseable is allowed.

import { execFileSync } from "node:child_process";

const PROTECTED = new Set(["main", "master"]);
const WRAPPERS = new Set(["sudo", "command", "exec", "time", "nohup", "env"]);
const GIT_OPTS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const COMMIT_OPTS_WITH_VALUE = new Set([
  "-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message",
  "-t", "--template", "--author", "--date", "--fixup", "--squash", "--cleanup", "--trailer",
  "--pathspec-from-file",
]);
const COMMIT_SHORT_WITH_VALUE = new Set(["m", "F", "C", "c", "t"]);
const PUSH_OPTS_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);

/** Split on ; & | and newlines outside quotes. */
function segments(input) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === "\\" && quote === '"') {
        cur += c + (input[++i] ?? "");
        continue;
      }
      if (c === quote) quote = null;
      cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === "\\") {
      cur += c + (input[++i] ?? "");
    } else if (";&|\n".includes(c)) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Shell-like word splitting with quote removal. */
function words(segment) {
  const out = [];
  let cur = null;
  let quote = null;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < segment.length) cur += segment[++i];
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      cur ??= "";
    } else if (c === "\\" && i + 1 < segment.length) {
      cur = (cur ?? "") + segment[++i];
    } else if (/\s/.test(c)) {
      if (cur !== null) out.push(cur);
      cur = null;
    } else {
      cur = (cur ?? "") + c;
    }
  }
  if (cur !== null) out.push(cur);
  return out;
}

const currentBranch = (cwd) => {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000,
    }).trim();
  } catch {
    return "";
  }
};

const refName = (ref) => ref.replace(/^\+/, "").split(":").pop().replace(/^refs\/heads\//, "");

function checkCommit(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") break;
    if (a === "--no-verify") return "git commit --no-verify skips the pre-commit and commit-msg hooks.";
    if (COMMIT_OPTS_WITH_VALUE.has(a)) {
      i++;
      continue;
    }
    if (/^-[^-]/.test(a)) {
      for (const ch of a.slice(1)) {
        if (ch === "n") return "git commit -n (--no-verify) skips the pre-commit and commit-msg hooks.";
        if (COMMIT_SHORT_WITH_VALUE.has(ch)) break;
      }
    }
  }
  return null;
}

function checkPush(args, cwd) {
  let force = false;
  let lease = false;
  let all = false;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") force = true;
    else if (a.startsWith("--force-with-lease")) lease = true;
    else if (a === "--all" || a === "--mirror" || a === "--branches") all = true;
    else if (PUSH_OPTS_WITH_VALUE.has(a)) i++;
    else if (/^-[^-]/.test(a) && a.slice(1).includes("f")) force = true;
    else if (!a.startsWith("-")) positional.push(a);
  }
  const refspecs = positional.slice(1);
  if (refspecs.some((r) => r.startsWith("+"))) force = true;
  if (!force && !lease) return null;

  const current = currentBranch(cwd);
  const targets = refspecs.length > 0 ? refspecs.map((r) => (refName(r) === "HEAD" ? current : refName(r))) : [current];
  if (all || targets.some((t) => PROTECTED.has(t) || t === "")) {
    return "Force pushing to main/master (or to an unknown target) is not allowed. Open a PR instead.";
  }
  if (force) return "Plain --force / -f / +refspec is not allowed. Use --force-with-lease on your feature branch.";
  return null;
}

function checkSegment(segment) {
  const w = words(segment.trim());
  let i = 0;
  while (i < w.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[i]) || WRAPPERS.has(w[i]))) i++;
  // Nested shells: bash -c "git commit -n ..."
  for (let j = 1; j < w.length; j++) {
    if (/^-\w*c$/.test(w[j - 1]) && /\bgit\s/.test(w[j])) {
      const nested = check(w[j]);
      if (nested) return nested;
    }
  }
  if (!(w[i] === "git" || w[i]?.endsWith("/git"))) return null;
  i++;
  let cwd;
  for (; i < w.length && w[i].startsWith("-"); i++) {
    const opt = w[i];
    if (opt === "-c" && /^core\.hookspath=/i.test(w[i + 1] ?? "")) return "git -c core.hooksPath=... bypasses the repo's git hooks.";
    if (opt === "-C") cwd = w[i + 1];
    if (GIT_OPTS_WITH_VALUE.has(opt)) i++;
  }
  const sub = w[i];
  const args = w.slice(i + 1);
  if (["commit", "push", "merge", "cherry-pick", "rebase", "am"].includes(sub) && args.includes("--no-verify")) {
    return `git ${sub} --no-verify skips the git hooks.`;
  }
  if (sub === "commit") return checkCommit(args);
  if (sub === "push") return checkPush(args, cwd);
  return null;
}

function check(command) {
  for (const seg of segments(command)) {
    const reason = checkSegment(seg);
    if (reason) return reason;
  }
  return null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }
  const reason = typeof command === "string" && command ? check(command) : null;
  if (!reason) process.exit(0);
  process.stderr.write(`BLOCKED: ${reason}\nFix what the hook reports instead of bypassing it.\n`);
  process.exit(2);
});
