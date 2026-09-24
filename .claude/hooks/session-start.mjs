#!/usr/bin/env node
// SessionStart: start the local Postgres (native cluster, else the Docker
// service) when nothing answers on localhost:5432, raise a native cluster's
// max_connections, and remind a worktree session that has no DATABASE_URL yet
// to create its own database. Stdout becomes session context: keep it short.
// Never blocks the session: always exits 0.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { join, resolve } from "node:path";

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
  } catch {
    return null;
  }
};

const portOpen = (port) =>
  new Promise((done) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (ok) => {
      socket.destroy();
      done(ok);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });

// Ten worktrees with four test slots open far more than the Debian default of
// 100 connections; docker-compose.yml runs the service with the same value.
const MAX_CONNECTIONS = 300;

// A native Debian/Ubuntu cluster (cloud sandboxes, where the VM can be
// recycled) takes precedence over the Docker service from docker-compose.yml.
// Raises max_connections (restarting a running cluster once) and starts the
// clusters that are down. Returns what was done, or null when nothing was.
function preparePostgres(root) {
  const clusters = sh("pg_lsclusters", ["--no-header"]);
  if (clusters) {
    const done = [];
    for (const [version, name, , status] of clusters.split("\n").map((line) => line.split(/\s+/))) {
      const current = Number(sh("pg_conftool", ["-s", version, name, "show", "max_connections"]) ?? 100);
      const raise = current < MAX_CONNECTIONS;
      if (raise) sh("pg_conftool", [version, name, "set", "max_connections", String(MAX_CONNECTIONS)]);
      const action = status === "down" ? "start" : raise ? "restart" : null;
      if (!action) continue;
      sh("pg_ctlcluster", [version, name, action], { timeout: 20000 });
      done.push(`pg_ctlcluster ${version} ${name} ${action}` + (raise ? ` (max_connections ${MAX_CONNECTIONS})` : ""));
    }
    return done.length ? done.join(", ") : null;
  }
  if (existsSync(join(root, "docker-compose.yml")) && sh("docker", ["info"], { timeout: 5000 }) !== null) {
    sh("docker", ["compose", "up", "-d", "postgres"], { cwd: root, timeout: 20000 });
    return "docker compose up -d postgres";
  }
  return null;
}

async function main() {
  const root = sh("git", ["rev-parse", "--show-toplevel"]) ?? process.env.CLAUDE_PROJECT_DIR;
  if (!root) return;

  const wasUp = await portOpen(5432);
  // The Docker service is only started when nothing answers on 5432.
  const how = wasUp && !sh("pg_lsclusters", ["--no-header"]) ? null : preparePostgres(root);
  if (how) {
    console.log(
      (await portOpen(5432))
        ? `Postgres: ${how}.`
        : `Postgres is down and \`${how}\` did not bring it up; start it before running DB tests.`,
    );
  }

  const gitDir = sh("git", ["rev-parse", "--path-format=absolute", "--git-dir"], { cwd: root });
  const commonDir = sh("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root });
  if (gitDir && commonDir && resolve(gitDir) !== resolve(commonDir)) {
    const envLocal = join(root, ".env.local");
    const content = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : "";
    if (!/^DATABASE_URL=\S/m.test(content)) {
      console.log("This worktree has no DATABASE_URL: run `pnpm tsx scripts/worktree-db.ts ensure`.");
    }
  }
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
