#!/usr/bin/env bash
# Runs on every Vercel deployment (`vercel-build` in package.json wins over
# `build` there — docs/06-vercel.md). Applies pending migrations before the
# build, since `next build` reads products from the database
# (generateStaticParams): a deploy must never build static pages against a
# schema the app hasn't migrated to yet.
#
# Migrations run over DATABASE_URL_UNPOOLED when Vercel provides it (Neon
# integration): a pooled connection can hold DDL behind pgbouncer's
# transaction pooling in ways a direct connection doesn't. Falls back to
# DATABASE_URL so this also works locally and anywhere else only that one is set.
set -euo pipefail

if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
	export DATABASE_URL="$DATABASE_URL_UNPOOLED"
fi

pnpm db:migrate
next typegen
next build
