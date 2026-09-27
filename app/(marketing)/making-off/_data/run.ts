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

export type Lane = { name: string; start: number; end: number; cycle: Cycle; agents: number };

// One lane per worktree: from its first agent's start to its last agent's end.
const LANE_ROWS: [string, number, number, Cycle, number][] = [
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
  ["QA · P1-L1 LOT LÉGER", 22.11, 22.43, "qa", 3],
  ["QA · P1-B3 PAIEMENT", 22.11, 24.31, "qa", 4],
  ["QA · P1-B4 VISITE DOUBLE", 22.12, 23.57, "qa", 4],
  ["QA · P1-B5 1RE GÉNÉRATION", 22.12, 22.45, "qa", 4],
  ["QA · P1-B12 STATUT HTTP", 22.12, 24.72, "qa", 4],
  ["QA · P1-Q5 FUNNEL", 22.19, 22.79, "qa", 4],
  ["QA · P1-M1 CONFIG", 22.19, 24.24, "qa", 4],
  ["QA · P1-Q2 INSCRIPTION", 22.2, 24.39, "qa", 5],
  ["QA · P1-B7 REFUS 402", 22.2, 22.79, "qa", 4],
  ["QA · P1-B14 CACHE", 22.24, 24.7, "qa", 4],
  ["QA · P2-N1 OPS", 25.98, 26.18, "qa", 2],
  ["QA · P2-S1 SLUG PRIS", 25.98, 26.38, "qa", 3],
  ["QA · P3-F1 FORMULAIRE", 26.79, 26.95, "qa", 2],
  ["QA · P4-E1 ERREURS", 27.38, 27.53, "qa", 2],
  ["QA · P5-E2 MESSAGES", 28.68, 28.75, "qa", 1],
  ["QA · P6-E3 PRICING", 29.02, 29.13, "qa", 1],
];

export const LANES: Lane[] = LANE_ROWS.map(([name, start, end, cycle, agents]) => ({
  name,
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

export type AgentRole = { role: string; count: number; job: string };

export const AGENT_ROLES: AgentRole[] = [
  { role: "tdd-guide", count: 61, job: "Implémente une spec, test d'abord" },
  { role: "general-purpose", count: 48, job: "Passes QA, vérifications" },
  { role: "planner", count: 39, job: "Transforme une spec en plan" },
  { role: "code-reviewer", count: 39, job: "Relit le diff contre la spec" },
  { role: "security-reviewer", count: 26, job: "Auth, crédits, entrées" },
  { role: "nextjs-reviewer", count: 19, job: "Rendu, cache, routes" },
  { role: "database-reviewer", count: 15, job: "Schéma, requêtes, ledger" },
  { role: "silent-failure-hunter", count: 8, job: "Erreurs avalées" },
  { role: "Explore", count: 3, job: "Recherche dans le code" },
];

export type ProcessStep = { title: string; who: string; humanGate: boolean };

export const PROCESS_STEPS: ProcessStep[] = [
  { title: "Dossier", who: "docs/ : 15 documents, source de vérité", humanGate: false },
  { title: "Specs", who: "28 specs, validées par l'humain", humanGate: true },
  { title: "Plan", who: "planner", humanGate: false },
  { title: "TDD", who: "tdd-guide, rouge puis vert", humanGate: false },
  { title: "Revue", who: "5 relecteurs spécialisés", humanGate: false },
  { title: "Verify", who: "pnpm check et conformité à la spec", humanGate: false },
  { title: "PR et merge", who: "branche d'intégration", humanGate: false },
  { title: "QA puis main", who: "constats validés, merge humain", humanGate: true },
];

export type KeyFigure = { value: string; label: string };

export const KEY_FIGURES: KeyFigure[] = [
  { value: "258", label: "agents lancés" },
  { value: "28", label: "specs mergées" },
  { value: "76", label: "pull requests" },
  { value: "1 718", label: "tests verts" },
  { value: "7", label: "passes QA" },
  { value: "0", label: "constat restant" },
];
