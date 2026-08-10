// @vitest-environment node
// adm-zip / tar-stream read raw buffer bytes; jsdom's Buffer shim in this
// project's default test environment mis-parses them, so this suite forces
// the real Node environment (matches the Next.js API runtime).
import zlib from "node:zlib";

import AdmZip from "adm-zip";
import * as tar from "tar-stream";
import { describe, expect, it, vi } from "vitest";

import { createMemoryRemoteFs } from "@/lib/discovery/file-server/memory-fs";
import {
  validateBackupsConnectionValues,
} from "@/lib/discovery/backups/connection-values";
import { runBackupsScan, safeBackupsScanErrorMessage } from "@/lib/discovery/backups/scan";

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

function buildZipBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile("hr/employee-master.csv", Buffer.from("email\nalice@example.com\n"));
  zip.addFile("notes.txt", Buffer.from("no pii here"));
  return zip.toBuffer();
}

async function buildTarBuffer(): Promise<Buffer> {
  const pack = tar.pack();
  pack.entry({ name: "hr/employee-master.csv" }, "email\nalice@example.com\n");
  pack.entry({ name: "notes.txt" }, "no pii here");
  pack.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

describe("backups connection-values", () => {
  it("requires basePath for local source", () => {
    expect(() => validateBackupsConnectionValues({ sourceType: "local" })).toThrow(
      /basePath is required/,
    );
  });

  it("requires sftp credentials", () => {
    expect(() =>
      validateBackupsConnectionValues({ sourceType: "sftp", basePath: "/backups" }),
    ).toThrow(/host is required/);
  });

  it("accepts a valid local configuration", () => {
    const values = validateBackupsConnectionValues({
      sourceType: "local",
      basePath: "/mnt/backups",
    });
    expect(values).toEqual({ sourceType: "local", basePath: "/mnt/backups" });
  });
});

describe("runBackupsScan", () => {
  it("extracts and scans zip archive members for PII", async () => {
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        "nightly-2024.zip": { type: "file", content: buildZipBuffer(), mtimeMs: 100 },
        "readme.txt": { type: "file", content: Buffer.from("not an archive") },
      },
    });

    const result = await runBackupsScan(
      { sourceType: "local", basePath: "/" },
      { coverageMode: "full", maxArchiveSizeMb: "100", maxArchives: "50", maxEntriesPerArchive: "200" },
      { fs },
    );

    expect(result.scopeValue).toBe(1);
    expect(
      result.findings.some(
        (f) => f.piiType === "Email" && f.location.includes("employee-master.csv"),
      ),
    ).toBe(true);
    expect(result.scanRun?.connectorId).toBe("backups");
  });

  it("extracts and scans .tar.gz archive members for PII", async () => {
    const tarBuffer = await buildTarBuffer();
    const gzBuffer = zlib.gzipSync(tarBuffer);
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        "nightly-2024.tar.gz": { type: "file", content: gzBuffer, mtimeMs: 100 },
      },
    });

    const result = await runBackupsScan(
      { sourceType: "local", basePath: "/" },
      { coverageMode: "full", maxArchiveSizeMb: "100", maxArchives: "50", maxEntriesPerArchive: "200" },
      { fs },
    );

    expect(result.scopeValue).toBe(1);
    expect(
      result.findings.some(
        (f) => f.piiType === "Email" && f.location.includes("employee-master.csv"),
      ),
    ).toBe(true);
  });

  it("extracts and scans plain .tar archive members for PII", async () => {
    const tarBuffer = await buildTarBuffer();
    const fs = createMemoryRemoteFs({
      type: "dir",
      children: {
        "nightly-2024.tar": { type: "file", content: tarBuffer, mtimeMs: 100 },
      },
    });

    const result = await runBackupsScan(
      { sourceType: "local", basePath: "/" },
      { coverageMode: "full", maxArchiveSizeMb: "100", maxArchives: "50", maxEntriesPerArchive: "200" },
      { fs },
    );

    expect(
      result.findings.some(
        (f) => f.piiType === "Email" && f.location.includes("employee-master.csv"),
      ),
    ).toBe(true);
  });
});

describe("safeBackupsScanErrorMessage", () => {
  it("maps connection errors", () => {
    expect(safeBackupsScanErrorMessage(new Error("connect ECONNREFUSED"))).toMatch(
      /Could not connect/,
    );
  });
});
