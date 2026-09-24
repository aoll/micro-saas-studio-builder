---
name: verification-loop
description: >
  Final quality gate before marking a PR ready or handing work back: runs the
  repo checks through the machine-wide queues, audits the diff against the
  spec, and returns a READY / NOT READY report. Use at the end of every
  implementation, after a large refactor, and whenever asked to "verify".
---

# Verification loop

Prove the work is done instead of claiming it. Run every phase, in order, and
stop at the first hard failure: fix it, then restart from phase 1.

## Phase 1 — Checks (queued)

Several worktrees share this machine. Full runs go through the queues so
parallel agents never run more than a few `tsc` or Vitest processes at once.

```bash
scripts/queued.sh typecheck pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
scripts/queued.sh test pnpm test
```

Run the E2E suite when the diff touches `app/**`, `e2e/**`, or anything a page
renders:

```bash
scripts/queued.sh e2e pnpm test:e2e
```

Rules:

- Redirect long output to a log file and read the failing part, not the whole
  log.
- A failing test is never "flaky" by default. Reproduce it alone, find the
  cause, fix it. Never skip, `.only`, or loosen an assertion to go green.
- Never edit lint, format, TypeScript or test configuration to make a check
  pass. A hook blocks it; ask the human if a config really needs to change.

## Phase 2 — Spec conformance

Open the spec named in the branch or PR (`specs/<REF>-<name>.md`).

- Every `Acceptation` bullet maps to at least one named test. List the mapping.
- Every changed file is inside `Périmètre`:
  `git diff --name-only origin/main...HEAD`
- No frozen contract changed (`lib/db/schema.ts`, `lib/schemas/**`, DAL
  signatures) unless the spec is a contract spec.
- Tests from the first push were not weakened:
  `git diff <first-push-sha>..HEAD -- '*.test.ts' e2e/`

## Phase 3 — Diff hygiene

```bash
git diff origin/main...HEAD
```

Look for, and fix:

- `console.log`, `debugger`, commented-out code, TODO without a spec reference
- secrets, tokens, `.env` values, hard-coded URLs to localhost ports
- `any`, non-null assertions (`!`) on data that can really be missing
- `'use client'` higher than the interactive leaf
- a Server Action without `requireUser()`/`requireAdmin()` and Zod parsing
- a new migration in `drizzle/` that was edited by hand
- `git status` clean: nothing uncommitted, nothing unpushed

## Phase 4 — Report

Reply with exactly this block:

```
VERIFICATION — <REF> <branch>
Checks     typecheck ✓ | lint ✓ | format ✓ | knip ✓ | unit ✓ (<n> tests) | e2e ✓/skipped
Spec       <k>/<k> acceptance bullets covered · scope ✓ · contracts ✓
Hygiene    ✓ | <issues fixed>
Verdict    READY | NOT READY — <blocking reason>
```

Only a READY verdict allows marking the PR ready for review.
