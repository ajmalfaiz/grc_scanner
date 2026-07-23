import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/discovery/postgres/scan", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/discovery/postgres/scan")
  >("@/lib/discovery/postgres/scan");
  return {
    ...actual,
    runPostgresScan: vi.fn(),
  };
});

import { POST } from "@/app/api/discovery/postgres/scan/route";
import { runPostgresScan } from "@/lib/discovery/postgres/scan";

describe("API /api/discovery/postgres/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates connectionValues", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing required credentials", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: { host: "localhost" },
          scopeValues: { coverageMode: "sample" },
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns scan findings on success", async () => {
    vi.mocked(runPostgresScan).mockResolvedValue({
      scopeLabel: "Tables catalogued",
      scopeValue: 2,
      findings: [
        {
          location: "public.users.email",
          piiType: "Email",
          confidence: "high",
          detectedVia: "both",
        },
      ],
      coverageLine:
        "All 2 scoped tables were sampled — sampled tables used the selected 1% row target",
      methodNote: "test",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            host: "localhost",
            port: "5432",
            database: "app",
            username: "reader",
            password: "secret",
            sslMode: "prefer",
          },
          scopeValues: { coverageMode: "sample", samplingRate: "1" },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].location).toBe("public.users.email");
  });

  it("accepts a scan request without a password", async () => {
    vi.mocked(runPostgresScan).mockResolvedValue({
      scopeLabel: "Tables catalogued",
      scopeValue: 0,
      findings: [],
      coverageLine: "No tables matched the selected scope.",
      methodNote: "test",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            host: "localhost",
            port: "5432",
            database: "pest_control_crm",
            username: "ajmalfaiz",
            password: "",
            sslMode: "prefer",
          },
          scopeValues: { coverageMode: "sample", samplingRate: "1" },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(runPostgresScan).toHaveBeenCalledWith(
      expect.objectContaining({ password: "" }),
      expect.any(Object),
      expect.objectContaining({ database: "pest_control_crm" }),
    );
  });

  it("accepts a scan request with a Postgres connection string", async () => {
    vi.mocked(runPostgresScan).mockResolvedValue({
      scopeLabel: "Tables catalogued",
      scopeValue: 0,
      findings: [],
      coverageLine: "No tables matched the selected scope.",
      methodNote: "test",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            connectionMode: "connectionString",
            connectionString:
              "postgresql://reader:secret@db.local:6543/app?sslmode=require",
          },
          scopeValues: { coverageMode: "sample", samplingRate: "1" },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(runPostgresScan).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "db.local",
        port: "6543",
        database: "app",
        username: "reader",
        password: "secret",
        sslMode: "require",
      }),
      expect.any(Object),
      expect.objectContaining({
        connectionString:
          "postgresql://reader:secret@db.local:6543/app?sslmode=require",
      }),
    );
  });

  it("maps connection failures to 502", async () => {
    vi.mocked(runPostgresScan).mockRejectedValue(
      new Error("password authentication failed for user"),
    );

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/scan", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            host: "localhost",
            port: "5432",
            database: "app",
            username: "reader",
            password: "bad",
            sslMode: "prefer",
          },
          scopeValues: {},
        }),
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/Authentication failed/);
  });
});
