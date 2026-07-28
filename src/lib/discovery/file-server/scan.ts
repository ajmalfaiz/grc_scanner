import { withRemoteFs } from "@/lib/discovery/file-server/connect";
import {
  normalizeFileServerScopeValues,
  validateFileServerConnectionValues,
} from "@/lib/discovery/file-server/connection-values";
import { inventoryRemoteFs } from "@/lib/discovery/file-server/inventory";
import {
  buildCoverageLine,
  buildCoverageSummary,
  contentHitsFromSamples,
  mergeFileFindings,
} from "@/lib/discovery/file-server/pii-merge";
import { sampleFileContent } from "@/lib/discovery/file-server/sample";
import {
  classifyFile,
  selectFilesForContent,
  triageInventory,
} from "@/lib/discovery/file-server/triage";
import type {
  CoverageIssue,
  FileEntry,
  FileServerConnectionValues,
  FileServerScanResultPayload,
  FileServerScopeValues,
  RemoteFs,
} from "@/lib/discovery/file-server/types";
import {
  DETECTOR_VERSION,
  SCAN_TIMEOUT_MS,
  SCANNER_VERSION,
} from "@/lib/discovery/file-server/types";
import { detectPiiInValuesDetailed } from "@/lib/discovery/pii-detectors";

export {
  normalizeFileServerScopeValues,
  validateFileServerConnectionValues,
};

export async function runFileServerScan(
  connection: FileServerConnectionValues,
  scope: FileServerScopeValues,
  options?: { fs?: RemoteFs },
): Promise<FileServerScanResultPayload> {
  const startedAt = new Date();
  const scanDeadline = startedAt.getTime() + SCAN_TIMEOUT_MS;

  const execute = async (fs: RemoteFs) => {
    const root = connection.basePath || "/";
    const inventory = await inventoryRemoteFs(fs, root);
    const issues: CoverageIssue[] = [...inventory.issues];

    const classified = inventory.files.map((file) => classifyFile(file, scope));
    const eligible: FileEntry[] = [];
    let skippedCount = 0;
    let partialCount = 0;
    let cappedCount = inventory.capped || inventory.timedOut ? 1 : 0;

    for (const decision of classified) {
      if (decision.status === "eligible") {
        eligible.push(decision.file);
        continue;
      }
      skippedCount += 1;
      const status =
        decision.status === "unsupported"
          ? "unsupported"
          : decision.status === "oversized"
            ? "skipped"
            : "skipped";
      issues.push({
        asset: decision.file.path,
        status,
        reason: decision.reason,
        estimatedRecords: 1,
      });
    }

    const nameHits = triageInventory(inventory.files);
    const selected = selectFilesForContent(eligible, nameHits, scope);

    if (scope.coverageMode === "sample" && eligible.length > selected.length) {
      cappedCount += 1;
      issues.push({
        asset: "content",
        status: "capped",
        reason: `Content sample limited to ${selected.length} of ${eligible.length} eligible files`,
        sampledRecords: selected.length,
        estimatedRecords: eligible.length,
      });
    }

    const notSelected = new Set(
      eligible
        .filter((file) => !selected.some((item) => item.path === file.path))
        .map((file) => file.path),
    );
    for (const path of notSelected) {
      issues.push({
        asset: path,
        status: "capped",
        reason: "Not selected in sample mode",
      });
    }

    let sampledRecords = 0;
    let matchedRecords = 0;
    let scannedCount = 0;
    const detections = new Map<
      string,
      Awaited<ReturnType<typeof detectPiiInValuesDetailed>>
    >();
    const samples = [];

    for (const file of selected) {
      if (Date.now() > scanDeadline) {
        cappedCount += 1;
        issues.push({
          asset: "content",
          status: "timeout",
          reason: `Content scan timed out after ${Math.round(SCAN_TIMEOUT_MS / 1000)}s`,
        });
        const remaining = selected.slice(selected.indexOf(file));
        for (const left of remaining) {
          issues.push({
            asset: left.path,
            status: "capped",
            reason: "Scan timeout before file was processed",
          });
        }
        break;
      }

      const sample = await sampleFileContent(fs, file, scope);
      samples.push(sample);

      if (sample.readError) {
        const denied = /permission|denied|EACCES/i.test(sample.readError);
        skippedCount += 1;
        issues.push({
          asset: file.path,
          status: denied ? "permission_denied" : "skipped",
          reason: sample.readError,
        });
        continue;
      }

      if (sample.extract.unsupported) {
        skippedCount += 1;
        issues.push({
          asset: file.path,
          status: "unsupported",
          reason: sample.extract.reason ?? "unsupported file content",
        });
        continue;
      }

      if (sample.extract.partial) {
        partialCount += 1;
        issues.push({
          asset: file.path,
          status: "partial",
          reason: sample.extract.reason ?? "partial text extraction",
          sampledRecords: sample.extract.sampledRecords,
        });
      }

      if (sample.extract.capped) {
        cappedCount += 1;
        issues.push({
          asset: file.path,
          status: "capped",
          reason: "Extract capped by scanner limits",
          sampledRecords: sample.extract.sampledRecords,
        });
      }

      scannedCount += 1;
      sampledRecords += sample.extract.sampledRecords;

      if (sample.extract.values.length === 0) {
        continue;
      }

      const detected = await detectPiiInValuesDetailed(sample.extract.values);
      detections.set(file.path, detected);
      for (const aggregate of detected.values()) {
        matchedRecords += aggregate.matchedRecords;
      }
    }

    const contentHits = contentHitsFromSamples(samples, detections);
    // Path triage only for files we inventoried; content merge handles agreement.
    const findings = mergeFileFindings(nameHits, contentHits);

    const coverage = buildCoverageSummary({
      discovered: inventory.files.length,
      scanned: scannedCount,
      skipped: skippedCount,
      partial: partialCount,
      capped: cappedCount,
      sampledRecords,
      matchedRecords,
    });

    const completedAt = new Date();
    const mode = scope.coverageMode === "full" ? "full" : "sample";

    return {
      scanRun: {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `scan-${completedAt.getTime().toString(36)}`,
        connectorId: "file-server" as const,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        scannerVersion: SCANNER_VERSION,
        detectorVersion: DETECTOR_VERSION,
        mode,
      },
      scopeLabel: "Files inventoried",
      scopeValue: inventory.files.length,
      findings,
      coverage,
      coverageIssues: issues,
      coverageLine: buildCoverageLine(coverage, issues),
      methodNote:
        `Share inventory → type/size/path triage → text extract (${mode}) → OpenRedaction in-process.`,
    } satisfies FileServerScanResultPayload;
  };

  if (options?.fs) {
    return execute(options.fs);
  }
  return withRemoteFs(connection, execute);
}

export function safeFileServerErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Scan failed";
  }
  const message = error.message;
  if (/encrypted|passphrase required|Cannot parse privateKey/i.test(message)) {
    return "Private key needs a passphrase — enter the key passphrase";
  }
  if (/auth|password|permission denied|login|private key|All configured authentication methods failed/i.test(message)) {
    return "Authentication failed — check username, password, or SSH private key";
  }
  if (/ECONNREFUSED|ENOTFOUND|timeout|Timed out|connect/i.test(message)) {
    return "Could not connect to the host — check host, port/share, and network access";
  }
  if (/shareName is required|Invalid protocol|Invalid port|is required/i.test(message)) {
    return message;
  }
  if (/No such file|ENOENT|not found/i.test(message)) {
    return "Path or share not found — check share name and base path";
  }
  return "Scan failed — could not complete the file server discovery run";
}
