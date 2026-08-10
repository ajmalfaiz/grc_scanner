import { afterEach, describe, expect, it, vi } from "vitest";

import { extractCursor, fetchResourceRecords } from "@/lib/discovery/saas/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractCursor", () => {
  it("finds common top-level cursor keys", () => {
    expect(extractCursor({ next_cursor: "abc" })).toBe("abc");
    expect(extractCursor({ nextPageToken: "xyz" })).toBe("xyz");
    expect(extractCursor({ next: 42 })).toBe("42");
  });

  it("finds a cursor nested under common wrapper keys", () => {
    expect(extractCursor({ meta: { next_cursor: "wrapped" } })).toBe("wrapped");
    expect(extractCursor({ pagination: { nextPageToken: "wrapped2" } })).toBe("wrapped2");
  });

  it("uses an explicit cursorPath when given", () => {
    expect(extractCursor({ page: { token: "explicit" } }, "page.token")).toBe("explicit");
  });

  it("returns undefined when nothing matches", () => {
    expect(extractCursor({ data: [] })).toBeUndefined();
  });
});

describe("fetchResourceRecords retry behavior", () => {
  it("retries once on HTTP 429 (honoring Retry-After) and then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return new Response("slow down", {
            status: 429,
            headers: { "Retry-After": "0" },
          });
        }
        return new Response(JSON.stringify({ data: [{ id: 1 }] }), { status: 200 });
      }),
    );

    const result = await fetchResourceRecords(
      { baseUrl: "https://api.example.com", authType: "none", resources: [] },
      "/api/v3/contacts",
      {
        pagination: "none",
        pageParam: "page",
        pageStart: "1",
        cursorParam: "cursor",
        maxPages: "1",
        maxObjectsPerResource: "500",
      },
      500,
      {},
    );

    expect(calls).toBe(2);
    expect(result.error).toBeUndefined();
    expect(result.records).toHaveLength(1);
  });
});
