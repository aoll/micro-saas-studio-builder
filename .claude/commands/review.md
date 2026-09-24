---
description: Review a PR, a branch or the current diff against its spec with code-reviewer plus the relevant specialist reviewers, and return one consolidated verdict.
argument-hint: "[PR number | branch | empty = current diff]"
---

Review target: `$ARGUMENTS`. Read-only: never edit, commit, push, comment on or approve the PR.

## 1. Gather
- PR number: `gh pr view $ARGUMENTS --json number,title,body,isDraft,baseRefName,headRefName` and `gh pr diff $ARGUMENTS --name-only`.
- Branch name: `git diff --name-only "origin/$INTEGRATION_BRANCH"...$ARGUMENTS`.
- Empty: `git diff --name-only --merge-base "origin/$INTEGRATION_BRANCH"` plus unstaged and untracked files.
- Stop with "Nothing to review." if the file list is empty.
- Locate the spec (`specs/<REF>-*.md`) from the PR body, branch name or changed files. If none is found, say so; code-reviewer will treat it as a finding.

## 2. Choose reviewers
Always `code-reviewer`. Add, based on the changed paths and diff content:
- `app/**`, `components/**`, `*.tsx`, `proxy.ts`, `next.config.ts` -> `nextjs-reviewer`
- `lib/db/**`, `drizzle/**`, `lib/dal/**` -> `database-reviewer`
- auth code, any `'use server'` file, `app/**/route.ts`, `lib/ai/**`, env module -> `security-reviewer`
- any added `try`/`catch`, `.catch`, `??`/`||` fallback or `after(` in `lib/dal/**`, `lib/ai/**`, credit or purchase code -> `silent-failure-hunter`

Complexity pass: while the agents run, apply the `ponytail-review` skill to the diff yourself and add its
findings as LOW (they never block).

## 3. Run in parallel
Launch all chosen agents in one message. Give each the same context: target (PR number, branch or "local diff"), spec path, changed file list, and "report only, do not edit".

## 4. Consolidate
- Merge findings; deduplicate by file:line and root cause, keeping the highest severity and the clearest fix. Credit every agent that raised it.
- Drop findings that lack a file:line or, for HIGH/CRITICAL, a concrete failure scenario.
- Do not add findings of your own.

## 5. Report
```
Review: <target>   Spec: <path | none>   Reviewers: <list>
Acceptance covered: n/m   Out-of-scope files: <list | none>
CRITICAL / HIGH / MEDIUM / LOW: findings with file:line, issue, fix, [agents]
Verdict: APPROVE | REQUEST CHANGES | BLOCK
```
Single verdict: BLOCK if any CRITICAL, REQUEST CHANGES if any HIGH, else APPROVE. Draft PRs get the same verdict labelled "(draft, informational)". Zero findings with APPROVE is a normal outcome.

<!-- Adapted from everything-claude-code (MIT). See .claude/THIRD_PARTY.md -->
