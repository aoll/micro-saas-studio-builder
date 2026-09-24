---
description: Implement one approved spec test-first, ending with a pull request ready for human review.
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
3. **Implement.** Delegate to the `tdd-writer` agent with the spec path, the blueprint if any, and the
   worktree to use (one worktree and one database per writing agent, created as described in the
   `worktrees` skill). It follows the `tdd-workflow` skill: failing tests pushed first as a draft PR,
   then implementation to green, refactor, queued full checks, PR marked ready.
4. **Report.** Show the PR link, the acceptance -> tests table, any test changed after the first push,
   and any blocker. Stop there: review and merge are human steps.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
