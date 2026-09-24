---
name: ponytail-review
description: >
  Code review focused exclusively on over-engineering. Finds what to delete:
  reinvented standard library or framework features, unneeded dependencies,
  speculative abstractions, dead flexibility. One line per finding. Use when
  asked "what can we delete", "is this over-engineered", or as the complexity
  pass of /review. Complements correctness-focused review.
---

Review diffs for unnecessary complexity. One line per finding: location, what
to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs.

Tags:

- `delete:` dead code, unused flexibility, feature not in the spec. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library or the platform ships. Name it.
- `native:` dependency or code doing what Next.js, React, Zod, Drizzle or shadcn/ui already do. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Examples

`L12-38: stdlib: 27-line slug helper. String.prototype.normalize + one regex, 2 lines.`

`L4: native: date-fns imported for one format call. Intl.DateTimeFormat, 0 deps.`

`lib/dal/products.ts:L88: yagni: ProductRepository interface with one implementation. Export the functions.`

`L30-44: shrink: manual loop builds a record. Object.fromEntries(entries), 1 line.`

## Scoring

End with: `net: -<N> lines possible.`

If there is nothing to cut, say `Lean already. Ship.` and stop.

## Boundaries

Scope: over-engineering only. Correctness, security and performance belong to
the other reviewers. Never flag for deletion: a test that covers an acceptance
bullet of the spec, input validation, auth checks, idempotency keys, refund
paths. Lists fixes, does not apply them.

---
Vendored from [ponytail](https://github.com/DietrichGebert/ponytail) v4.10.0
(`e3ba2aa`), MIT, © 2026 DietrichGebert. Adapted to the stack and to TDD.
See `.claude/THIRD_PARTY.md`.
