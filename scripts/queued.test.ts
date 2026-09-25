// scripts/queued.sh, e2e queue: each Playwright run starts its own server on
// $E2E_PORT, so two e2e slots must never share a port.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const QUEUED = resolve(__dirname, "queued.sh");
const PRINT_PORT = ["e2e", "sh", "-c", 'printf "%s\\n" "$E2E_PORT"; cat >/dev/null'];
const lockDirs: string[] = [];

const newLockDir = (slots: number): string => {
  const dir = mkdtempSync(join(tmpdir(), "msb-queue-test-"));
  writeFileSync(join(dir, "e2e.slots"), `${slots}\n`);
  lockDirs.push(dir);
  return dir;
};

/** The test runner's environment without E2E_PORT, plus the lock dir and overrides. */
const envFor = (lockDir: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, QUEUE_LOCK_DIR: lockDir, ...extra };
  if (!("E2E_PORT" in extra)) delete env.E2E_PORT;
  return env;
};

const portOfOneJob = (lockDir: string, extra: Record<string, string> = {}): string =>
  execFileSync(QUEUED, PRINT_PORT, { env: envFor(lockDir, extra), encoding: "utf8", input: "" }).trim();

afterEach(() => {
  for (const dir of lockDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("queued.sh e2e ports", () => {
  it("runs a single slot on the default port 3100", () => {
    expect(portOfOneJob(newLockDir(1))).toBe("3100");
  });

  it("keeps an explicit E2E_PORT on a single slot", () => {
    expect(portOfOneJob(newLockDir(1), { E2E_PORT: "3150" })).toBe("3150");
  });

  it("gives two concurrent jobs on two slots two different ports, 3100 and 3101", async () => {
    const lockDir = newLockDir(2);
    // The first job holds its slot until its stdin closes.
    const holder = spawn(QUEUED, PRINT_PORT, { env: envFor(lockDir), stdio: ["pipe", "pipe", "ignore"] });
    const holderPort = await new Promise<string>((done) =>
      holder.stdout.once("data", (chunk: Buffer) => done(chunk.toString().trim())),
    );
    try {
      const secondPort = portOfOneJob(lockDir);
      expect([holderPort, secondPort].sort()).toEqual(["3100", "3101"]);
    } finally {
      holder.stdin.end();
      await new Promise((done) => holder.once("exit", done));
    }
  });
});
