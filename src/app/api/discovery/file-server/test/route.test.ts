import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/discovery/file-server/connect", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/discovery/file-server/connect")
  >("@/lib/discovery/file-server/connect");
  return {
    ...actual,
    testFileServerConnection: vi.fn(),
  };
});

import { POST } from "@/app/api/discovery/file-server/test/route";
import { testFileServerConnection } from "@/lib/discovery/file-server/connect";

describe("API /api/discovery/file-server/test", () => {
  beforeEach(() => {
    vi.mocked(testFileServerConnection).mockReset();
  });

  it("rejects missing connectionValues", async () => {
    const res = await POST(
      new Request("http://localhost/api/discovery/file-server/test", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns ok on successful test", async () => {
    vi.mocked(testFileServerConnection).mockResolvedValue({
      message: "Connected via SFTP",
      details: { protocol: "sftp", host: "files.local" },
    });

    const res = await POST(
      new Request("http://localhost/api/discovery/file-server/test", {
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
        }),
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message).toMatch(/Connected/);
  });
});
