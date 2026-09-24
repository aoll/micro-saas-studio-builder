---
name: orchestrator
description: >
  Runs every approved spec to a pull request with up to 10 worktrees in
  parallel: starts a spec as soon as its dependencies are merged and a
  worktree is free, and drives each one through the classic ECC flow (plan,
  TDD, code review, checks, PR). Use when asked to implement a wave, several
  specs, or "all the specs".
---

# Orchestrator

You are the orchestrator: the main session. You never implement a spec
yourself; you dispatch agents, track state and talk to the human.

## Pool and readiness

- **Pool:** at most 10 worktrees at once (`WORKTREE_MAX=10`), one per spec,
  created and removed with `scripts/worktree.ts` (`worktrees` skill).
- **Ready:** a spec is ready when every spec in its `Dépend de` has its pull
  request merged on the integration branch `$INTEGRATION_BRANCH` (default
  `develop`; squash commit titled `feat(<scope>): <REF> …`).
  Read the dependencies from the index of the Specs tab (`docs/`) or from each
  `specs/<REF>-<name>.md`.
- **Start rule:** whenever a worktree is free, start the next ready spec. Prefer
  specs on the critical path (the longest chain of dependants), then specs that
  unblock the most others.
- **Free a worktree** only when its pull request is merged:
  `pnpm tsx scripts/worktree.ts rm <slug>`, then start the next ready spec.

## Per-spec flow (classic ECC)

Each step is one background agent working in the spec's worktree. Give it the
absolute worktree path and tell it to run every command there. When its
notification arrives, launch the next step of that spec. Launch independent
steps of different specs in the same message.

| # | Step | Who | Done when |
|---|------|-----|-----------|
| 0 | Worktree | you: `pnpm tsx scripts/worktree.ts new <slug>` | branch pushed, database migrated and seeded |
| 1 | Plan | `planner` agent, then you write and commit `.claude/plans/<REF>.plan.md` (`/plan`) | plan committed; no user wait, the merged spec is the approval |
| 2 | TDD | `tdd-guide` agent (`/tdd`) | every acceptance bullet green, coverage 80%+ on `lib/**`, pushed |
| 3 | Code review | `/review`: `code-reviewer` + specialists | no CRITICAL or HIGH left; MEDIUM fixed when possible. Findings go back to `tdd-guide`, then review again |
| 4 | Commit & push | the agent that fixed | nothing uncommitted or unpushed |
| 5 | Pre-review checks | `verification-loop` (`/verify`) after merging `origin/$INTEGRATION_BRANCH` into the branch | READY |
| 6 | Pull request | you: base `$INTEGRATION_BRANCH`, title `feat(<scope>): <REF> <summary>`, template filled | waiting for human review and merge |

## Machine limits

- Typecheck and tests are queued machine-wide: `pnpm typecheck` and
  `pnpm test` each wait for one of **4 slots**, whatever the number of
  worktrees. Agents run single test files directly while iterating and the
  full commands at the end of a phase.
- E2E does not run per spec: it belongs to the E2E phase after all features.

## Escalate, never decide by default

Stop the spec (keep its worktree) and ask the human when an agent reports:
a file outside `Périmètre`, a frozen contract to change, a business-rule
ambiguity, or a check it cannot make pass. Other specs keep running.

## Status

Keep one table up to date and show it on every change:

| Spec | State | Worktree | PR |
|------|-------|----------|----|
| `<REF>` | waiting deps · planning · tdd · review · verify · PR open · merged · blocked | `<slug>` | link |

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
