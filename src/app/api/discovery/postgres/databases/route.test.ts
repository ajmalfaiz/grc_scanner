import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/discovery/postgres/list-databases", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/discovery/postgres/list-databases")
  >("@/lib/discovery/postgres/list-databases");
  return {
    ...actual,
    listPostgresDatabases: vi.fn(),
  };
});

import { POST } from "@/app/api/discovery/postgres/databases/route";
import { listPostgresDatabases } from "@/lib/discovery/postgres/list-databases";

describe("API /api/discovery/postgres/databases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates connectionValues", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/databases", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns available databases", async () => {
    vi.mocked(listPostgresDatabases).mockResolvedValue(["app", "hr"]);

    const res = await POST(
      new Request("http://localhost/api/discovery/postgres/databases", {
        method: "POST",
        body: JSON.stringify({
          connectionValues: {
            host: "localhost",
            port: "5432",
            username: "reader",
            password: "secret",
            sslMode: "prefer",
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      databases: ["app", "hr"],
    });
  });
});
