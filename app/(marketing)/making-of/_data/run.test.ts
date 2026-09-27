import { describe, expect, it } from "vitest";
import {
  AGENTS_PER_HOUR,
  AGENT_ROLES,
  LANES,
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
