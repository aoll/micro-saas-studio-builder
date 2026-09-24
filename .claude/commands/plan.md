---
description: Restate a spec's requirements, assess risks, and write its step-by-step implementation plan to .claude/plans/<REF>.plan.md. WAIT for user CONFIRM before touching any code, unless run by the orchestrator.
argument-hint: "<specs/REF-name.md>"
---

# Plan Command

This command creates a comprehensive implementation plan for one approved spec before writing any code.

Spec: $ARGUMENTS

## What This Command Does

1. **Restate Requirements** - The spec's acceptance bullets, contract and scope
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases (delegate to the `planner` agent)
4. **Wait for Confirmation** - MUST receive user approval before proceeding, except in an orchestrated
   run (`orchestrator` skill): there the approved and merged spec is the confirmation

## Pattern Grounding

Before writing the plan, search the codebase for conventions the implementation should mirror. Capture the top example for each relevant category with file references:

| Category | What to capture |
|---|---|
| Naming | File, function, type and route naming in the affected area |
| Error handling | Server Action return shapes for `useActionState`, `notFound()`, refunds |
| Data access | DAL functions in `lib/dal/*`, transactions, idempotency keys |
| Tests | Test file location, Vitest helpers, fixtures, assertion style |

If no similar code exists, state that explicitly. Do not invent a pattern.

## Plan Artifact

Write the plan to `.claude/plans/<REF>.plan.md`, in the spec's worktree, with this structure, and commit
it (`docs(<scope>): <REF> implementation plan`):

````markdown
# Plan: <REF> · <Nom>

**Source spec**: specs/<REF>-<name>.md
**Complexity**: {Small | Medium | Large}

## Summary
{2-3 sentences}

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `path:line` | {short description} |
| Errors | `path:line` | {short description} |
| Tests | `path:line` | {short description} |

## Files to Change
| File | Action | Why |
|---|---|---|
| `path` | CREATE / UPDATE / DELETE | {reason} |

## Tasks
### Task 1: {name}
- **Action**: {what to do}
- **Mirror**: {pattern to follow}
- **Validate**: {command that proves correctness}

## Validation
```bash
pnpm vitest run <test files of this spec>
pnpm typecheck        # queued, 4 slots per machine
pnpm test             # queued, 4 slots per machine
pnpm check
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|

## Acceptance
- [ ] All tasks complete
- [ ] Validation passes
- [ ] Patterns mirrored, not reinvented
- [ ] Every acceptance bullet of the spec has a test
````

After writing the artifact, report its path and WAIT for confirmation before writing code (not in an
orchestrated run).

## Important Notes

**CRITICAL**: Run by hand, this command will **NOT** write any code until you explicitly confirm the
plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"

In an orchestrated run, `/plan` is the plan of a `classic` spec: the `triage` agent
has already looked at the code, so give its report to the `planner`. `inline` specs get a
shorter plan written by `triage` itself; `direct` specs get none.

## Integration with Other Commands

After planning:
- `/tdd <spec>` to implement the plan with the `tdd-guide` agent
- `/review` to review the completed implementation
- `/verify` before opening the pull request

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
