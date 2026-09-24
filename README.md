# micro-saas-studio-builder

## Run locally

```bash
pnpm install
pnpm tsx scripts/worktree-db.ts ensure --seed
pnpm dev
```

Runs in `AI_MODE=mock` by default: no AI Gateway key is needed. Open
`http://localhost:3000/demo` for the seeded product and
`http://localhost:3000/admin/login` for the backoffice (seeded admin account,
see `scripts/seed.ts`).
