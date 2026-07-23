import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/discovery/postgres/connect", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/discovery/postgres/connect")
  >("@/lib/discovery/postgres/connect");
  return {
    ...actual,
    testPostgresConnection: vi.fn(),
  };
});

import { POST } from "@/app/api/discovery/postgres/test/route";
import { testPostgresConnection } from "@/lib/discovery/postgres/connect";

describe("API /api/discovery/postgres/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates connectionValues", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns success when credentials work", async () => {
    vi.mocked(testPostgresConnection).mockResolvedValue({
      ok: true,
      serverVersion: "16.2",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/test", {
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
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/16\.2/);
  });

  it("accepts connections without a password", async () => {
    vi.mocked(testPostgresConnection).mockResolvedValue({
      ok: true,
      serverVersion: "16.2",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/test", {
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
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(testPostgresConnection).toHaveBeenCalledWith(
      expect.objectContaining({ password: "" }),
    );
  });

  it("accepts a Postgres connection string", async () => {
    vi.mocked(testPostgresConnection).mockResolvedValue({
      ok: true,
      serverVersion: "16.2",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/test", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            connectionMode: "connectionString",
            connectionString:
              "postgresql://reader:secret@db.local:6543/app?sslmode=require",
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(testPostgresConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "db.local",
        port: "6543",
        database: "app",
        username: "reader",
        password: "secret",
        sslMode: "require",
      }),
    );
  });

  it("maps auth failures to 502", async () => {
    vi.mocked(testPostgresConnection).mockRejectedValue(
      new Error("password authentication failed for user"),
    );

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/test", {
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
        }),
      }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/Authentication failed/);
  });
});
