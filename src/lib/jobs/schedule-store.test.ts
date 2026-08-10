import { afterEach, describe, expect, it, vi } from "vitest";

const { scanMock } = vi.hoisted(() => ({ scanMock: vi.fn() }));

vi.mock("@/lib/discovery/registry", () => ({
  getConnector: () => ({ id: "postgres", capabilities: [], scan: scanMock }),
}));

import { resetJobStoreForTests } from "@/lib/jobs/job-store";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  redactScheduleConnection,
  resetScheduleStoreForTests,
  runScheduleNow,
  setScheduleEnabled,
  toPublicSchedule,
} from "@/lib/jobs/schedule-store";

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timed out waiting"));
      setTimeout(tick, 5);
    };
    tick();
  });
}

afterEach(() => {
  resetScheduleStoreForTests();
  resetJobStoreForTests();
});

describe("redactScheduleConnection / toPublicSchedule", () => {
  it("blanks out secret fields but keeps everything else", () => {
    const redacted = redactScheduleConnection({ host: "db", password: "shh", username: "u" });
    expect(redacted).toEqual({ host: "db", password: "", username: "u" });
  });

  it("never includes raw credentials in the public view", () => {
    const schedule = createSchedule({
      connectorId: "postgres",
      label: "Nightly",
      connectionValues: { host: "db", password: "shh" },
      scopeValues: {},
      intervalMinutes: 60,
    });
    const pub = toPublicSchedule(schedule);
    expect(pub.connectionValues.password).toBe("");
    expect(pub.connectionValues.host).toBe("db");
  });
});

describe("schedule CRUD", () => {
  it("creates, lists, enables/disables, and deletes a schedule", () => {
    const schedule = createSchedule({
      connectorId: "postgres",
      label: "Nightly scan",
      connectionValues: { host: "db" },
      scopeValues: {},
      intervalMinutes: 60,
    });

    expect(listSchedules()).toHaveLength(1);
    expect(schedule.enabled).toBe(true);

    const disabled = setScheduleEnabled(schedule.id, false);
    expect(disabled?.enabled).toBe(false);

    expect(deleteSchedule(schedule.id)).toBe(true);
    expect(listSchedules()).toHaveLength(0);
  });

  it("clamps the interval to a sane minimum", () => {
    const schedule = createSchedule({
      connectorId: "postgres",
      label: "Too frequent",
      connectionValues: {},
      scopeValues: {},
      intervalMinutes: 0.1,
    });
    expect(schedule.intervalMinutes).toBeGreaterThanOrEqual(5);
  });
});

describe("runScheduleNow", () => {
  it("starts a job and records it in the schedule's run history once finished", async () => {
    scanMock.mockResolvedValue({
      id: "postgres",
      name: "Postgres",
      icon: () => null,
      scopeLabel: "Tables catalogued",
      scopeValue: 2,
      findings: [{ location: "a.b.c", piiType: "Email", confidence: "high", detectedVia: "both" }],
      coverageLine: "ok",
      methodNote: "note",
    });

    const schedule = createSchedule({
      connectorId: "postgres",
      label: "Nightly",
      connectionValues: { host: "db" },
      scopeValues: {},
      intervalMinutes: 60,
    });

    const job = runScheduleNow(schedule.id);
    expect(job).toBeDefined();
    expect(schedule.runs).toHaveLength(1);

    await waitFor(() => schedule.runs[0]?.status === "completed");

    expect(schedule.runs[0].summary).toMatch(/1 finding/);
    expect(schedule.lastRunAt).toBeDefined();
  });

  it("returns undefined for an unknown schedule id", () => {
    expect(runScheduleNow("nope")).toBeUndefined();
  });
});
