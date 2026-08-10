import { afterEach, describe, expect, it, vi } from "vitest";

import { extractRecords } from "@/lib/discovery/saas/client";
import { runSaasScan } from "@/lib/discovery/saas/scan";

afterEach(() => {
  vi.unstubAllGlobals();
});

vi.mock("@/lib/discovery/pii-detectors", () => ({
  detectPiiInValuesDetailed: vi.fn(async (values: unknown[]) => {
    const map = new Map();
    const joined = values.map(String).join(" ");
    if (/@/.test(joined)) {
      map.set("Email", {
        piiType: "Email",
        hitCount: 1,
        matchedRecords: 1,
        detectorIds: ["openredaction.email.v1"],
        category: "contact",
        riskLevel: "high",
        validators: ["openredaction"],
        reasons: ["OpenRedaction detected EMAIL"],
      });
    }
    return map;
  }),
}));

describe("extractRecords", () => {
  it("returns a top-level array as-is", () => {
    expect(extractRecords([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it("finds a wrapped array under common keys", () => {
    expect(extractRecords({ data: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(extractRecords({ results: [{ b: 2 }] })).toEqual([{ b: 2 }]);
  });

  it("uses an explicit resultsPath", () => {
    expect(extractRecords({ payload: { rows: [{ c: 3 }] } }, "payload.rows")).toEqual([{ c: 3 }]);
  });

  it("wraps a single object response", () => {
    expect(extractRecords({ id: 1, name: "solo" })).toEqual([{ id: 1, name: "solo" }]);
  });
});

describe("runSaasScan", () => {
  it("fetches configured resources and detects PII in field values", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/contacts")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 1, email: "alice@example.com" },
              { id: 2, email: "bob@example.com" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runSaasScan(
      {
        baseUrl: "https://api.example.com",
        authType: "bearer",
        bearerToken: "secret",
        resources: [{ name: "contacts", path: "/api/v3/contacts" }],
      },
      {
        pagination: "page_param",
        pageParam: "page",
        pageStart: "1",
        cursorParam: "cursor",
        maxPages: "2",
        maxObjectsPerResource: "500",
        nameTriage: "heuristics",
        maxDepth: "3",
      },
    );

    expect(result.scopeValue).toBe(1);
    expect(result.findings.some((f) => f.piiType === "Email" && f.location === "contacts.email")).toBe(
      true,
    );
    expect(result.scanRun?.connectorId).toBe("saas");
  });

  it("records a coverage issue when a resource returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );

    const result = await runSaasScan(
      {
        baseUrl: "https://api.example.com",
        authType: "bearer",
        bearerToken: "bad",
        resources: [{ name: "contacts", path: "/api/v3/contacts" }],
      },
      {
        pagination: "none",
        pageParam: "page",
        pageStart: "1",
        cursorParam: "cursor",
        maxPages: "1",
        maxObjectsPerResource: "500",
      },
    );

    expect(result.coverageIssues?.some((i) => i.status === "permission_denied")).toBe(true);
  });

  it("follows cursor pagination until the response stops returning a next cursor", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (!url.includes("cursor=")) {
          return new Response(
            JSON.stringify({
              data: [{ id: 1, email: "alice@example.com" }],
              next_cursor: "page-2",
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ data: [{ id: 2, email: "bob@example.com" }] }),
          { status: 200 },
        );
      }),
    );

    const result = await runSaasScan(
      {
        baseUrl: "https://api.example.com",
        authType: "none",
        resources: [{ name: "contacts", path: "/api/v3/contacts" }],
      },
      {
        pagination: "cursor",
        pageParam: "page",
        pageStart: "1",
        cursorParam: "cursor",
        maxPages: "5",
        maxObjectsPerResource: "500",
        nameTriage: "heuristics",
        maxDepth: "3",
      },
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("cursor=page-2");
    expect(result.coverage?.sampledRecords).toBe(2);
  });

  it("fetches an OAuth2 client-credentials token once and reuses it across resources", async () => {
    const tokenCalls: string[] = [];
    const resourceCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
        if (url.includes("/oauth/token")) {
          tokenCalls.push(url);
          return new Response(
            JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }),
            { status: 200 },
          );
        }
        resourceCalls.push(String((init?.headers as Record<string, string> | undefined)?.Authorization));
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }),
    );

    await runSaasScan(
      {
        baseUrl: "https://api.example.com",
        authType: "oauth2_client_credentials",
        tokenUrl: "https://api.example.com/oauth/token",
        clientId: "client-1",
        clientSecret: "secret-1",
        resources: [
          { name: "contacts", path: "/api/v3/contacts" },
          { name: "companies", path: "/api/v3/companies" },
        ],
      },
      {
        pagination: "none",
        pageParam: "page",
        pageStart: "1",
        cursorParam: "cursor",
        maxPages: "1",
        maxObjectsPerResource: "500",
        nameTriage: "heuristics",
        maxDepth: "3",
      },
    );

    expect(tokenCalls).toHaveLength(1); // cached across both resource fetches
    expect(resourceCalls).toEqual(["Bearer fresh-token", "Bearer fresh-token"]);
  });
});
