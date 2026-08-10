import { describe, expect, it, vi } from "vitest";

import { createMemoryRemoteFs } from "@/lib/discovery/file-server/memory-fs";
import { parsePathList, validateServerConnectionValues } from "@/lib/discovery/server/connection-values";
import { runServerScan, safeServerErrorMessage } from "@/lib/discovery/server/scan";

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

describe("server connection-values", () => {
  it("parses newline-separated paths", () => {
    expect(parsePathList("/var/log\n/etc/app\n\n")).toEqual(["/var/log", "/etc/app"]);
  });

  it("requires at least one path", () => {
    expect(() =>
      validateServerConnectionValues({ host: "h", username: "u", password: "p" }),
    ).toThrow(/paths is required/);
  });
});

describe("runServerScan", () => {
  it("scans configured paths for log/config content and reports findings", async () => {
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        var: {
          type: "dir",
          children: {
            log: {
              type: "dir",
              children: {
                "auth.log": {
                  type: "file",
                  content: Buffer.from(
                    "user login from admin@example.com\nno pii here\n",
                  ),
                  mtimeMs: 100,
                },
              },
            },
          },
        },
      },
    });

    const result = await runServerScan(
      {
        host: "app-01.internal",
        port: "22",
        username: "svc",
        authMethod: "password",
        password: "secret",
        paths: ["/var/log"],
      },
      {
        coverageMode: "sample",
        extensions: "log",
        recursive: "yes",
        lineSample: "head_tail",
      },
      { fs },
    );

    expect(result.scopeValue).toBe(1);
    expect(result.findings.some((f) => f.piiType === "Email")).toBe(true);
    expect(result.findings[0]?.asset?.assetType).toBe("server_path");
    expect(result.scanRun?.connectorId).toBe("server");
  });

  it("filters out files by extension allowlist", async () => {
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        etc: {
          type: "dir",
          children: {
            "binary.exe": { type: "file", content: Buffer.from("binary") },
            "config.env": {
              type: "file",
              content: Buffer.from("ADMIN_EMAIL=admin@example.com\n"),
            },
          },
        },
      },
    });

    const result = await runServerScan(
      {
        host: "app-01.internal",
        port: "22",
        username: "svc",
        authMethod: "password",
        password: "secret",
        paths: ["/etc"],
      },
      { coverageMode: "sample", extensions: "env", recursive: "yes", lineSample: "head_tail" },
      { fs },
    );

    expect(result.findings.some((f) => f.location.endsWith("config.env"))).toBe(true);
    expect(result.coverageIssues?.some((i) => i.asset.endsWith("binary.exe"))).toBe(true);
  });
});

describe("safeServerErrorMessage", () => {
  it("maps auth and connect errors", () => {
    expect(safeServerErrorMessage(new Error("All configured authentication methods failed"))).toMatch(
      /Authentication failed/,
    );
    expect(safeServerErrorMessage(new Error("connect ECONNREFUSED"))).toMatch(/Could not connect/);
  });
});
