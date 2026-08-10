import { afterEach, describe, expect, it, vi } from "vitest";

import { runDiscoveryScanJob } from "@/lib/discovery-scan-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runDiscoveryScanJob", () => {
  it("starts a job, polls until completed, and resolves with the result", async () => {
    const statuses: string[] = [];
    let pollCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/discovery/jobs" && init?.method === "POST") {
        return new Response(JSON.stringify({ jobId: "job-1", status: "queued" }), { status: 202 });
      }
      if (url === "/api/discovery/jobs/job-1") {
        pollCount += 1;
        if (pollCount < 3) {
          return new Response(JSON.stringify({ status: "running" }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            status: "completed",
            result: {
              scopeLabel: "Tables catalogued",
              scopeValue: 5,
              findings: [],
              coverageLine: "ok",
              methodNote: "note",
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runDiscoveryScanJob(
      {
        connectorId: "postgres",
        connectionValues: { host: "db" },
        scopeValues: {},
      },
      { onStatus: (s) => statuses.push(s), pollIntervalMs: 1 },
    );

    expect(result.scopeValue).toBe(5);
    expect(statuses).toEqual(["running", "running", "completed"]);
  });

  it("throws with the job's error message when the scan fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/discovery/jobs" && init?.method === "POST") {
          return new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 });
        }
        return new Response(
          JSON.stringify({ status: "failed", error: "Authentication failed" }),
          { status: 200 },
        );
      }),
    );

    await expect(
      runDiscoveryScanJob(
        { connectorId: "postgres", connectionValues: {}, scopeValues: {} },
        { pollIntervalMs: 1 },
      ),
    ).rejects.toThrow(/Authentication failed/);
  });

  it("throws when the job fails to start", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "connectorId is required" }), { status: 400 })),
    );

    await expect(
      runDiscoveryScanJob(
        { connectorId: "postgres", connectionValues: {}, scopeValues: {} },
        { pollIntervalMs: 1 },
      ),
    ).rejects.toThrow(/connectorId is required/);
  });
});
