import { describe, expect, it } from "vitest";
import fr from "@/messages/fr/making-of.json";
import en from "@/messages/en/making-of.json";
import {
  AGENTS_PER_HOUR,
  AGENT_ROLES,
  KEY_FIGURES,
  LANES,
  PROCESS_STEPS,
  QA_PASSES,
  TIMELINE_END,
  TIMELINE_START,
  clockLabel,
  timelinePercent,
} from "./run";

describe("timelinePercent", () => {
  it("maps the timeline window onto 0–100", () => {
    expect(timelinePercent(TIMELINE_START)).toBe(0);
    expect(timelinePercent(TIMELINE_END)).toBe(100);
    expect(timelinePercent((TIMELINE_START + TIMELINE_END) / 2)).toBe(50);
  });

  it("clamps hours outside the window", () => {
    expect(timelinePercent(0)).toBe(0);
    expect(timelinePercent(40)).toBe(100);
  });
});

describe("clockLabel", () => {
  it("gives the Paris wall-clock time of an hour of the run", () => {
    expect(clockLabel(0)).toBe("12:50");
    expect(clockLabel(9.57)).toBe("22:24");
  });

  it("wraps past midnight", () => {
    expect(clockLabel(20.95)).toBe("09:47");
  });
});

describe("run data", () => {
  it("has one lane per worktree: 43 for the implementation, 16 for the QA", () => {
    expect(LANES).toHaveLength(59);
    expect(LANES.filter((lane) => lane.cycle === "implementation")).toHaveLength(43);
    expect(LANES.filter((lane) => lane.cycle === "qa")).toHaveLength(16);
  });

  it("keeps every lane inside the timeline, ending after it starts", () => {
    for (const lane of LANES) {
      expect(lane.start).toBeGreaterThanOrEqual(TIMELINE_START);
      expect(lane.end).toBeLessThanOrEqual(TIMELINE_END);
      expect(lane.end).toBeGreaterThan(lane.start);
    }
  });

  it("counts the 258 agents of the run across the roles", () => {
    expect(AGENT_ROLES.reduce((sum, role) => sum + role.count, 0)).toBe(258);
  });

  it("has one agents-per-hour value per hour of the timeline", () => {
    expect(AGENTS_PER_HOUR).toHaveLength(TIMELINE_END - TIMELINE_START);
  });

  it("ends the QA on a pass with no finding", () => {
    expect(QA_PASSES).toHaveLength(7);
    expect(QA_PASSES.at(-1)?.findings).toBe(0);
  });
});

// I18N-MARKETING (plan step 8): the repo-wide fr/en parity test
// (i18n/messages.test.ts) only checks the two message files agree with
// each other — it can't catch this data drifting away from *either* of
// them (a role, step id, figure id or QA lane renamed here but not in
// messages/{fr,en}/making-of.json, or vice versa).
describe("run data drives messages/{fr,en}/making-of.json (not just each other)", () => {
  it("has a job message for every agent role, in both locales", () => {
    for (const { role } of AGENT_ROLES) {
      expect(fr.agentRoles.jobs, `fr agentRoles.jobs.${role}`).toHaveProperty(role);
      expect(en.agentRoles.jobs, `en agentRoles.jobs.${role}`).toHaveProperty(role);
    }
  });

  it("has a title and who message for every process step, in both locales", () => {
    for (const { id } of PROCESS_STEPS) {
      expect(fr.processSteps, `fr processSteps.${id}`).toHaveProperty(id);
      expect(en.processSteps, `en processSteps.${id}`).toHaveProperty(id);
    }
  });

  it("has a label message for every key figure, in both locales", () => {
    for (const { id } of KEY_FIGURES) {
      expect(fr.keyFigures, `fr keyFigures.${id}`).toHaveProperty(id);
      expect(en.keyFigures, `en keyFigures.${id}`).toHaveProperty(id);
    }
  });

  it("has a label message for every QA lane's labelId, in both locales", () => {
    const labelIds = LANES.map((lane) => lane.labelId).filter((id) => id !== undefined);
    expect(labelIds.length).toBeGreaterThan(0);
    for (const id of labelIds) {
      expect(fr.qaLanes, `fr qaLanes.${id}`).toHaveProperty(id);
      expect(en.qaLanes, `en qaLanes.${id}`).toHaveProperty(id);
    }
  });
});
