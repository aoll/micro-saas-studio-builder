---
description: Implement one approved spec test-first by following its plan, committing at every green step.
argument-hint: "<specs/REF-name.md>"
---

# /tdd

Spec: $ARGUMENTS

1. **Check the input.** The spec exists on the default branch, its `Dépend de` specs are merged, and
   `.claude/plans/<REF>.plan.md` exists in the worktree. No plan: run `/plan` first.
2. **Implement.** Delegate to the `tdd-guide` agent with the spec path, the plan path and the worktree
   (one worktree and one database per writing agent, `worktrees` skill). It follows the plan task by
   task and the `tdd-workflow` skill: red then green, commit and push at every green step, no pause
   until the spec is done; then coverage, `pnpm typecheck` and `pnpm test` (queued, 2 slots each).
3. **Report.** The acceptance -> tests table, any test changed after being committed, and any blocker.
   Next steps of the flow: `/review`, `/verify`, then the pull request.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
