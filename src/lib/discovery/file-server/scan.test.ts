import { describe, expect, it, vi } from "vitest";

import { createMemoryRemoteFs } from "@/lib/discovery/file-server/memory-fs";
import {
  runFileServerScan,
  safeFileServerErrorMessage,
} from "@/lib/discovery/file-server/scan";

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

describe("runFileServerScan", () => {
  it("inventories files, extracts csv content, and returns findings", async () => {
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        hr: {
          type: "dir",
          children: {
            "employee-master.csv": {
              type: "file",
              content: Buffer.from(
                "email,name\nalice@example.com,Alice\nbob@example.com,Bob\n",
              ),
              mtimeMs: 200,
            },
            "notes.txt": {
              type: "file",
              content: Buffer.from("no pii here"),
              mtimeMs: 100,
            },
            "archive.zip": {
              type: "file",
              content: Buffer.from("binary"),
              mtimeMs: 50,
            },
          },
        },
      },
    });

    const result = await runFileServerScan(
      {
        protocol: "sftp",
        host: "files.local",
        username: "svc",
        password: "secret",
        port: "22",
        basePath: "/",
      },
      {
        coverageMode: "sample",
        fileTypes: "office_text",
        maxFileSizeMb: "25",
        maxFiles: "50",
        prefer: "recent",
      },
      { fs },
    );

    expect(result.scopeValue).toBe(3);
    expect(result.coverage?.assetsDiscovered).toBe(3);
    expect(result.findings.some((finding) => finding.piiType === "Email")).toBe(
      true,
    );
    expect(
      result.findings.some(
        (finding) => finding.location === "/hr/employee-master.csv",
      ),
    ).toBe(true);
    expect(
      result.coverageIssues?.some((issue) => issue.status === "unsupported"),
    ).toBe(true);
    expect(result.methodNote).toMatch(/OpenRedaction/);
    expect(result.scanRun?.connectorId).toBe("file-server");
  });

  it("scans sql dumps for PII in all mode", async () => {
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        "backup.sql": {
          type: "file",
          content: Buffer.from(
            "INSERT INTO contacts VALUES (1, 'alice@example.com');\n",
          ),
          mtimeMs: 300,
        },
        "mystery": {
          type: "file",
          content: Buffer.from("reach me at bob@example.com\n"),
          mtimeMs: 200,
        },
      },
    });

    const result = await runFileServerScan(
      {
        protocol: "sftp",
        host: "files.local",
        username: "svc",
        password: "secret",
        port: "22",
        basePath: "/",
      },
      {
        coverageMode: "full",
        fileTypes: "all",
        maxFileSizeMb: "25",
        maxFiles: "50",
        prefer: "recent",
      },
      { fs },
    );

    expect(
      result.findings.some(
        (finding) => finding.location === "/backup.sql" && finding.piiType === "Email",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.location === "/mystery" && finding.piiType === "Email",
      ),
    ).toBe(true);
  });

  it("records permission denied coverage issues", async () => {
    const fs = createMemoryRemoteFs(
      {
        type: "dir",
        children: {
          secret: {
            type: "dir",
            children: {
              "a.csv": {
                type: "file",
                content: Buffer.from("email\nalice@example.com\n"),
              },
            },
          },
        },
      },
      { denyPaths: new Set(["/secret"]) },
    );

    const result = await runFileServerScan(
      {
        protocol: "sftp",
        host: "files.local",
        username: "svc",
        password: "secret",
        port: "22",
        basePath: "/",
      },
      {
        coverageMode: "full",
        fileTypes: "all",
        maxFileSizeMb: "25",
        maxFiles: "50",
        prefer: "recent",
      },
      { fs },
    );

    expect(
      result.coverageIssues?.some(
        (issue) =>
          issue.asset === "/secret" && issue.status === "permission_denied",
      ),
    ).toBe(true);
  });
});

describe("safeFileServerErrorMessage", () => {
  it("maps auth and connect errors", () => {
    expect(
      safeFileServerErrorMessage(new Error("All configured authentication methods failed")),
    ).toMatch(/Authentication failed/);
    expect(
      safeFileServerErrorMessage(new Error("connect ECONNREFUSED")),
    ).toMatch(/Could not connect/);
  });
});
