import { afterEach, describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above the rest of the file, and this
// project's vitest config sets restoreMocks: true (which wipes a
// vi.fn().mockImplementation(...) built inside a factory back to a no-op
// before every test). vi.hoisted() plus a plain function sidesteps both
// issues — see src/lib/discovery/email/connect.test.ts for the same pattern.
const { scanMock } = vi.hoisted(() => ({ scanMock: vi.fn() }));

vi.mock("@/lib/discovery/registry", () => ({
  getConnector: () => ({ id: "postgres", capabilities: [], scan: scanMock }),
}));

import { getJob, listJobs, resetJobStoreForTests, startScanJob } from "@/lib/jobs/job-store";

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
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
  resetJobStoreForTests();
});

describe("job-store", () => {
  it("starts a job in 'queued' status and moves to 'completed' once the scan resolves", async () => {
    scanMock.mockResolvedValue({
      id: "postgres",
      name: "Postgres",
      icon: () => null,
      scopeLabel: "Tables catalogued",
      scopeValue: 3,
      findings: [],
      coverageLine: "ok",
      methodNote: "note",
    });

    const job = startScanJob({
      connectorId: "postgres",
      connectionValues: { host: "db" },
      scopeValues: {},
    });

    // runJob() starts synchronously up to its first await, so status may
    // already read "running" by the time startScanJob returns — either is
    // valid, the two states just aren't observable as separate ticks here.
    expect(["queued", "running"]).toContain(job.status);

    await waitFor(() => getJob(job.id)?.status === "completed");

    const finished = getJob(job.id);
    expect(finished?.result?.scopeValue).toBe(3);
    expect(finished?.completedAt).toBeDefined();
  });

  it("moves to 'failed' and records the error message when the scan rejects", async () => {
    scanMock.mockRejectedValue(new Error("Authentication failed"));

    const job = startScanJob({
      connectorId: "postgres",
      connectionValues: { host: "db" },
      scopeValues: {},
    });

    await waitFor(() => getJob(job.id)?.status === "failed");

    const finished = getJob(job.id);
    expect(finished?.error).toBe("Authentication failed");
  });

  it("returns undefined for an unknown job id", () => {
    expect(getJob("does-not-exist")).toBeUndefined();
  });

  it("lists jobs newest first", async () => {
    scanMock.mockResolvedValue({
      id: "postgres",
      name: "Postgres",
      icon: () => null,
      scopeLabel: "x",
      scopeValue: 0,
      findings: [],
      coverageLine: "ok",
      methodNote: "note",
    });

    const first = startScanJob({ connectorId: "postgres", connectionValues: {}, scopeValues: {} });
    await new Promise((r) => setTimeout(r, 5));
    const second = startScanJob({ connectorId: "postgres", connectionValues: {}, scopeValues: {} });

    const jobs = listJobs();
    expect(jobs[0].id).toBe(second.id);
    expect(jobs[1].id).toBe(first.id);
  });
});
