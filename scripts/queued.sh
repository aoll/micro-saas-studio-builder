#!/usr/bin/env bash
# Machine-wide concurrency queue for heavy commands, shared by every worktree.
# Up to 10 worktrees run agents in parallel on one machine; when all of them
# start a full typecheck or test suite at once, memory runs out and the OOM
# killer takes processes down. This caps concurrency per queue.
#
# Usage: scripts/queued.sh <test|typecheck|e2e> <command...>
#   e.g. scripts/queued.sh test vitest run (what `pnpm test` runs; never wrap a pnpm script that already queues)
# Slots: QUEUE_SLOTS_TEST (default 4), QUEUE_SLOTS_TYPECHECK (4), QUEUE_SLOTS_E2E (1),
# overridden by <lock dir>/<queue>.slots, which scripts/monitor.ts tunes to the
# machine's load. Lock dir: QUEUE_LOCK_DIR (default /tmp/msb-queue).
# Each job leaves a <queue>.wait.<pid> then <queue>.run.<pid> marker for the monitor.
#
# Locks use flock (no daemon): the lock is bound to the process's file
# descriptor, so the kernel releases it even on kill -9 or a sandbox reset.
# There is never a stale lockfile to clean up by hand.

set -uo pipefail
# No `set -e`: a failing command (a real red test) must propagate its exit code.

usage() {
	echo "Usage: $0 <test|typecheck|e2e> <command...>" >&2
	exit 2
}

[ "$#" -ge 2 ] || usage
queue="$1"
shift
cmd=("$@")

case "$queue" in
test) default_slots="${QUEUE_SLOTS_TEST:-4}" ;;
typecheck) default_slots="${QUEUE_SLOTS_TYPECHECK:-4}" ;;
e2e) default_slots="${QUEUE_SLOTS_E2E:-1}" ;;
*) usage ;;
esac

lock_dir="${QUEUE_LOCK_DIR:-/tmp/msb-queue}"
mkdir -p "$lock_dir"

# The monitor's value when there is one, else the environment default.
read_slots() {
	local value="$default_slots"
	[ -f "$lock_dir/$queue.slots" ] && value="$(tr -d '[:space:]' <"$lock_dir/$queue.slots")"
	if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
		echo "[queue:$queue] invalid slot count '$value' (must be a positive integer)" >&2
		exit 2
	fi
	slots="$value"
}
read_slots

if ! command -v flock >/dev/null 2>&1; then
	echo "[queue:$queue] 'flock' not found. On macOS: brew install flock. On Debian/Ubuntu it ships with util-linux." >&2
	exit 127
fi

trap 'rm -f "$lock_dir/$queue.wait.$$" "$lock_dir/$queue.run.$$"' EXIT
: >"$lock_dir/$queue.wait.$$"

# The lock is held on fixed fd 9 (works with macOS's bash 3.2, unlike {fd}).
# The command runs with fd 9 closed so a daemon it spawns cannot keep the slot.
run_locked() {
	echo "[queue:$queue] slot $1 acquired: ${cmd[*]}" >&2
	rm -f "$lock_dir/$queue.wait.$$"
	: >"$lock_dir/$queue.run.$$" # fresh mtime: the monitor shows time since start
	"${cmd[@]}" 9>&-
	local code=$?
	flock -u 9
	exit "$code"
}

if [ "$slots" -eq 1 ]; then
	# Single slot: native blocking flock, the kernel queues waiters itself.
	exec 9>"$lock_dir/$queue-1.lock"
	if ! flock -n 9; then
		echo "[queue:$queue] slot busy, waiting: ${cmd[*]}" >&2
		flock 9
	fi
	run_locked "1/1"
fi

# Several slots: poll all of them. Blocking on one slot would leave the others
# idle once their jobs finish, silently degrading concurrency to 1.
start=$((RANDOM % slots))
logged_wait=0
while true; do
	read_slots # the monitor may have changed it while we wait
	for ((offset = 0; offset < slots; offset++)); do
		i=$(((start + offset) % slots + 1))
		exec 9>"$lock_dir/$queue-$i.lock"
		if flock -n 9; then
			run_locked "$i/$slots"
		fi
		exec 9>&-
	done
	if [ "$logged_wait" -eq 0 ]; then
		echo "[queue:$queue] all $slots slots busy, waiting: ${cmd[*]}" >&2
		logged_wait=1
	fi
	sleep 0.3
done
