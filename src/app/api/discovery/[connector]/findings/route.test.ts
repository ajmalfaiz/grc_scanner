import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/discovery/[connector]/findings/route";

describe("API /api/discovery/[connector]/findings", () => {
  it("returns a paginated findings page for fixture-only connectors", async () => {
    const res = await GET(
      new Request(
        "http://localhost/api/discovery/mysql/findings?page=0&pageSize=2",
      ),
      { params: Promise.resolve({ connector: "mysql" }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connectorId).toBe("mysql");
    expect(body.page).toBe(0);
    expect(body.pageSize).toBe(2);
    expect(body.total).toBeGreaterThan(2);
    expect(body.items).toHaveLength(2);
    expect(body.hasMore).toBe(true);
  });

  it("does not serve mock findings for postgres", async () => {
    const res = await GET(
      new Request("http://localhost/api/discovery/postgres/findings"),
      { params: Promise.resolve({ connector: "postgres" }) },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/saved live scan/i);
  });

  it("returns 404 for unknown connectors", async () => {
    const res = await GET(
      new Request("http://localhost/api/discovery/unknown/findings"),
      { params: Promise.resolve({ connector: "unknown" }) },
    );

    expect(res.status).toBe(404);
  });
});
