import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/discovery/file-server/scan", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/discovery/file-server/scan")
  >("@/lib/discovery/file-server/scan");
  return {
    ...actual,
    runFileServerScan: vi.fn(),
  };
});

import { POST } from "@/app/api/discovery/file-server/scan/route";
import { runFileServerScan } from "@/lib/discovery/file-server/scan";

describe("API /api/discovery/file-server/scan", () => {
  beforeEach(() => {
    vi.mocked(runFileServerScan).mockReset();
  });

  it("rejects missing connectionValues", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/file-server/scan", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns scan payload", async () => {
    vi.mocked(runFileServerScan).mockResolvedValue({
      scopeLabel: "Files inventoried",
      scopeValue: 2,
      findings: [],
      coverageLine: "All 2 inventoried files assessed.",
      methodNote: "Share inventory → text extract",
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/file-server/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionValues: {
            protocol: "sftp",
            host: "files.local",
            port: "22",
            username: "svc",
            password: "secret",
          },
          scopeValues: {
            coverageMode: "sample",
            fileTypes: "office_text",
            maxFileSizeMb: "25",
            maxFiles: "50",
            prefer: "recent",
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scopeValue).toBe(2);
    expect(runFileServerScan).toHaveBeenCalled();
  });
});
