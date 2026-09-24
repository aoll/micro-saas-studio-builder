---
description: Implement one approved spec test-first, committing at every green step, ending with a pull request ready for human review.
argument-hint: "<specs/REF-name.md>"
---

# /tdd

Spec: $ARGUMENTS

1. **Check the input.** The spec file exists and is merged on the default branch. Its `Dépend de` specs
   are merged. If not, report what is missing and stop.
2. **Blueprint (non-trivial specs only).** When the spec adds a DAL function, a Server Action, a route or
   modal, a cache boundary or an AI call, delegate to the `code-architect` agent with the spec. If it
   reports a blocker (file outside Périmètre, frozen contract change), stop and show it to the user.
   Skip this step for copy, style or single-component changes.
3. **Implement.** Delegate to the `tdd-guide` agent with the spec path, the blueprint if any, and the
   worktree to use (one worktree and one database per writing agent, created as described in the
   `worktrees` skill). It follows the `tdd-workflow` skill: one behavior at a time, red then green,
   commit and push at every green step, no pause until the spec is done; then coverage, the
   `verification-loop` skill until READY, and the PR.
4. **Report.** Show the PR link, the acceptance -> tests table, any test changed after being committed,
   and any blocker. Stop there: review and merge are human steps.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
