// The making-of's figures, frozen from the logs of the run itself: the 258
// sub-agents' transcripts (start, end, role, worktree), the run registries
// (.claude/runs/v1.json, .claude/runs/qa1.json) and the QA reports of
// .claude/qa/reports/. Times are hours since the first agent of the run,
// 24 Sept. 2026 at 12:50 (Paris time), so the page needs no database and
// renders fully static.

/** Paris wall-clock minutes of hour 0 of the run (24 Sept. 2026, 12:50). */
const RUN_START_MINUTES = 12 * 60 + 50;

/** The timeline's time window, in hours since the start of the run. */
export const TIMELINE_START = 9;
export const TIMELINE_END = 30;

/** Position of an hour of the run on the timeline, from 0 to 100. */
export function timelinePercent(hour: number): number {
  const clamped = Math.min(Math.max(hour, TIMELINE_START), TIMELINE_END);
  return ((clamped - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
}

/** Paris wall-clock time of an hour of the run, as "HH:MM". */
export function clockLabel(hour: number): string {
  const minutes = Math.round(RUN_START_MINUTES + hour * 60) % (24 * 60);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type Cycle = "implementation" | "qa";

// `labelId` keys messages/{fr,en}/making-of.json's `qaLanes`: the "QA ·
// P1-B3" prefix is the spec's own code, a technical identifier that stays
// as-is in both locales (implementation lane names, e.g. "SETUP-SKELETON",
// are the same kind of identifier and never had a labelId to begin with);
// only the descriptive suffix that used to follow it (e.g. "PAIEMENT") is
// translated, run-timeline.tsx composes the two back together.
export type Lane = { name: string; labelId?: string; start: number; end: number; cycle: Cycle; agents: number };

// One lane per worktree: from its first agent's start to its last agent's end.
const LANE_ROWS: [string, number, number, Cycle, number, string?][] = [
  ["SETUP-SKELETON", 9.57, 10.72, "implementation", 10],
  ["CONTRACT-TYPES", 10.74, 11.33, "implementation", 7],
  ["CONTRACT-DATA", 11.35, 12.29, "implementation", 7],
  ["CONTRACT-UI", 11.36, 12.86, "implementation", 7],
  ["SA-01-LANDING", 12.9, 13.48, "implementation", 6],
  ["SA-08-INTROUVABLE", 12.9, 16.82, "implementation", 6],
  ["SA-02-OUTIL", 12.91, 13.94, "implementation", 8],
  ["LEDGER", 12.91, 14.95, "implementation", 10],
  ["SA-04-TARIFS", 12.91, 13.41, "implementation", 5],
  ["BO-01-CONNEXION", 12.91, 13.28, "implementation", 5],
  ["TRACKING", 12.91, 13.58, "implementation", 7],
  ["BO-05A-FORMULAIRE", 12.92, 13.87, "implementation", 7],
  ["BO-07-THEMES", 12.92, 14.2, "implementation", 5],
  ["BO-02-PORTEFEUILLE", 13.6, 14.79, "implementation", 6],
  ["SA-06-HISTORIQUE", 13.98, 14.52, "implementation", 5],
  ["BO-05B-GENERATION", 13.98, 14.92, "implementation", 5],
  ["SA-01-FOLLOWUP", 13.98, 14.03, "implementation", 2],
  ["BO-08-EDITEUR-THEME", 14.21, 14.9, "implementation", 5],
  ["SIDEBAR-FOLLOWUP", 14.21, 14.27, "implementation", 2],
  ["EVENTS-TEST-FOLLOWUP", 14.4, 14.48, "implementation", 1],
  ["BO-03-FICHE", 14.82, 15.98, "implementation", 5],
  ["BO-09-SEUILS", 14.82, 16.82, "implementation", 5],
  ["THEME-CARD-LINK", 14.91, 15.02, "implementation", 2],
  ["SLUG-RACE-FOLLOWUP", 14.95, 15.11, "implementation", 2],
  ["SA-03-INSCRIPTION", 14.97, 16.22, "implementation", 6],
  ["SA-05-PAIEMENT", 14.97, 16.15, "implementation", 5],
  ["SA-07-COMPTE", 14.98, 16.88, "implementation", 6],
  ["PRODUCT-FORM-FLAKE", 15.12, 15.55, "implementation", 1],
  ["BO-06-STATUT", 16.0, 16.48, "implementation", 5],
  ["FOLLOWUP-SA-05", 16.24, 17.1, "implementation", 2],
  ["FOLLOWUP-FLAKY", 16.42, 18.57, "implementation", 2],
  ["FOLLOWUP-BO-06", 16.49, 16.98, "implementation", 3],
  ["BO-04-ACTIVITE", 16.91, 17.66, "implementation", 5],
  ["DEMO-MODE", 16.91, 18.35, "implementation", 4],
  ["I18N-SEO", 16.91, 17.42, "implementation", 3],
  ["SECURITY", 16.91, 17.82, "implementation", 4],
  ["CONTRACT-REMOVE-LOCK", 17.42, 17.97, "implementation", 4],
  ["FOLLOWUP-BO-04", 17.68, 18.44, "implementation", 2],
  ["FOLLOWUP-SEO", 18.37, 18.66, "implementation", 2],
  ["DOCS-POST-RUN", 19.14, 19.22, "implementation", 1],
  ["TEST-HYGIENE", 20.21, 20.31, "implementation", 1],
  ["TOOLING-TEST-TX", 20.22, 20.95, "implementation", 4],
  ["TOOLING-QA-SKILL", 20.45, 20.68, "implementation", 1],
  ["QA · P1-L1", 22.11, 22.43, "qa", 3, "light-lot"],
  ["QA · P1-B3", 22.11, 24.31, "qa", 4, "payment"],
  ["QA · P1-B4", 22.12, 23.57, "qa", 4, "double-visit"],
  ["QA · P1-B5", 22.12, 22.45, "qa", 4, "first-generation"],
  ["QA · P1-B12", 22.12, 24.72, "qa", 4, "http-status"],
  ["QA · P1-Q5", 22.19, 22.79, "qa", 4, "funnel"],
  ["QA · P1-M1", 22.19, 24.24, "qa", 4, "config"],
  ["QA · P1-Q2", 22.2, 24.39, "qa", 5, "signup"],
  ["QA · P1-B7", 22.2, 22.79, "qa", 4, "refusal-402"],
  ["QA · P1-B14", 22.24, 24.7, "qa", 4, "cache"],
  ["QA · P2-N1", 25.98, 26.18, "qa", 2, "ops"],
  ["QA · P2-S1", 25.98, 26.38, "qa", 3, "slug-taken"],
  ["QA · P3-F1", 26.79, 26.95, "qa", 2, "form"],
  ["QA · P4-E1", 27.38, 27.53, "qa", 2, "errors"],
  ["QA · P5-E2", 28.68, 28.75, "qa", 1, "messages"],
  ["QA · P6-E3", 29.02, 29.13, "qa", 1, "pricing"],
];

export const LANES: Lane[] = LANE_ROWS.map(([name, start, end, cycle, agents, labelId]) => ({
  name,
  ...(labelId ? { labelId } : {}),
  start,
  end,
  cycle,
  agents,
}));

/** Round Paris hours shown under the timeline, in hours of the run. */
export const TIMELINE_TICKS = [9.17, 13.17, 17.17, 21.17, 25.17, 29.17];

/** Agents at work during each hour of the run, from hour 9 to hour 29. */
export const AGENTS_PER_HOUR = [3, 10, 10, 22, 51, 41, 32, 23, 22, 7, 1, 6, 1, 24, 11, 13, 3, 8, 4, 2, 2];

/** The hour the QA cycle starts: before it, the implementation cycle. */
export const QA_CYCLE_START = 21;

export type QaPass = { pass: number; start: number; findings: number };

// Findings recorded by each QA pass (.claude/runs/qa1.json › passes).
export const QA_PASSES: QaPass[] = [
  { pass: 1, start: 21.44, findings: 22 },
  { pass: 2, start: 25.29, findings: 1 },
  { pass: 3, start: 26.42, findings: 2 },
  { pass: 4, start: 27.09, findings: 1 },
  { pass: 5, start: 27.57, findings: 1 },
  { pass: 6, start: 28.76, findings: 1 },
  { pass: 7, start: 29.15, findings: 0 },
];

// `role` stays untranslated (a technical agent name, like a lane's spec
// code): only its `job` description lives in messages, under
// `agentRoles.jobs.<role>`.
export type AgentRole = { role: string; count: number };

export const AGENT_ROLES: AgentRole[] = [
  { role: "tdd-guide", count: 61 },
  { role: "general-purpose", count: 48 },
  { role: "planner", count: 39 },
  { role: "code-reviewer", count: 39 },
  { role: "security-reviewer", count: 26 },
  { role: "nextjs-reviewer", count: 19 },
  { role: "database-reviewer", count: 15 },
  { role: "silent-failure-hunter", count: 8 },
  { role: "Explore", count: 3 },
];

// `title`/`who` live in messages/{fr,en}/making-of.json's `processSteps.<id>`.
export type ProcessStep = { id: string; humanGate: boolean };

export const PROCESS_STEPS: ProcessStep[] = [
  { id: "dossier", humanGate: false },
  { id: "specs", humanGate: true },
  { id: "plan", humanGate: false },
  { id: "tdd", humanGate: false },
  { id: "review", humanGate: false },
  { id: "verify", humanGate: false },
  { id: "pr-merge", humanGate: false },
  { id: "qa-main", humanGate: true },
];

// `label` lives in messages/{fr,en}/making-of.json's `keyFigures.<id>`;
// `value` is now a number so ControlRoomHeader can format it per locale
// (useFormatter, fr "1 718" vs en "1,718").
export type KeyFigure = { id: string; value: number };

export const KEY_FIGURES: KeyFigure[] = [
  { id: "total-agents", value: 258 },
  { id: "specs", value: 28 },
  { id: "pull-requests", value: 76 },
  { id: "tests", value: 1718 },
  { id: "qa-passes", value: 7 },
  { id: "findings-remaining", value: 0 },
];

// `title`/`body` live in messages/{fr,en}/making-of.json's
// `sinceLaunch.items.<id>`. What shipped after this run reached `main`
// (PR #76): not one more giant run, several separate workstreams, some
// through the same spec → orchestrator → PR flow (SA-09-facture #81/#86,
// this run's own I18N-* specs), others built directly with the human in a
// single session (the landing #82, the architecture explorer #91, this
// page itself #87) — both are legitimate per CLAUDE.md's workflow, which
// only mandates the full spec flow for the backoffice and the product
// sub-apps, not this marketing/making-of page category.
export type SinceLaunchItem = { id: string };

export const SINCE_LAUNCH_ITEMS: SinceLaunchItem[] = [
  { id: "invoices" },
  { id: "architecture" },
  { id: "landing" },
  { id: "making-of" },
  { id: "translation" },
];
