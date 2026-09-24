---
description: Turn a feature request or a dossier section into reviewed specs, then stop for human approval before writing them.
argument-hint: "<feature request | docs/<file>.md § section>"
---

# /plan

Input: $ARGUMENTS

If the input is empty, ask what should be planned and stop.

1. **Plan.** Delegate to the `planner` agent with the input. It returns one or more specs in the French
   template, a dependency graph and open questions.
2. **Review.** Delegate to the `architect` agent with the planner output and the in-flight specs in
   `specs/`. Apply the review protocol from its prompt:
   - Apply every fully specified fix yourself in the spec text. Re-dispatch `planner` only when a
     finding needs new design work.
   - CRITICAL/HIGH are always fixed. MEDIUM/LOW are fixed only if they touch dependencies, write scopes
     or a verbatim value; otherwise keep them as risk lines.
   - If a CRITICAL/HIGH repeats a category fixed in round 1, sweep the whole text for the same pattern.
   - At most 2 review rounds. Round 2 checks only the round 1 fixes. Unresolved CRITICAL/HIGH keep the
     loop going; other residuals go to the human gate.
3. **Present and stop.** Show the user:
   - each spec in full, with its target path `specs/<REF>-<name>.md`;
   - the dependency graph and proposed wave;
   - the architect verdict, risk lines and accepted residuals;
   - open questions.
   Then STOP. Do not write any file and do not start implementation.
4. **After explicit approval**, write each approved spec to `specs/<REF>-<name>.md` exactly as approved,
   and report the paths. Implementation starts separately with `/tdd <spec file>` once the spec is merged.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
