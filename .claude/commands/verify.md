---
description: Run the verification loop on the current branch and report READY / NOT READY.
argument-hint: "[spec file]"
---

Run the `verification-loop` skill on the current branch.

Spec: $ARGUMENTS (if empty, infer it from the branch name or the PR body).

Fix every failure you find, restarting the loop after each fix. Do not push
and do not mark the PR ready: end with the report block from the skill.
