import { withServerFs } from "@/lib/discovery/server/connect";
import {
  normalizeServerScopeValues,
  parseExtensionAllowlist,
  validateServerConnectionValues,
} from "@/lib/discovery/server/connection-values";
import { windowLines } from "@/lib/discovery/server/sample";
import { inventoryRemoteFs } from "@/lib/discovery/file-server/inventory";
import {
  buildCoverageLine,
  buildCoverageSummary,
  mergeFileFindings,
  type ContentFindingAggregate,
} from "@/lib/discovery/file-server/pii-merge";
import {
  classifyFileByAllowlist,
  selectFilesGeneric,
  triageInventory,
} from "@/lib/discovery/file-server/triage";
import type { CoverageIssue, FileEntry, RemoteFs } from "@/lib/discovery/file-server/types";
import { MAX_WALK_DEPTH } from "@/lib/discovery/file-server/types";
import { detectPiiInValuesDetailed } from "@/lib/discovery/pii-detectors";
import type {
  ServerConnectionValues,
  ServerScanResultPayload,
  ServerScopeValues,
} from "@/lib/discovery/server/types";
import {
  DETECTOR_VERSION,
  MAX_FILE_SIZE_MB,
  MAX_FILES_SAMPLE,
  SCANNER_VERSION,
} from "@/lib/discovery/server/types";

export { normalizeServerScopeValues, validateServerConnectionValues };

async function inventoryPaths(fs: RemoteFs, paths: string[], scope: ServerScopeValues) {
  const files: FileEntry[] = [];
  const issues: CoverageIssue[] = [];
  let capped = false;
  let timedOut = false;

  for (const root of paths) {
    const result = await inventoryRemoteFs(fs, root, {
      maxDepth: scope.recursive === "no" ? 0 : MAX_WALK_DEPTH,
    });
    files.push(...result.files);
    issues.push(...result.issues);
    capped = capped || result.capped;
    timedOut = timedOut || result.timedOut;
  }

  return { files, issues, capped, timedOut };
}

export async function runServerScan(
  connection: ServerConnectionValues,
  scope: ServerScopeValues,
  options?: { fs?: RemoteFs },
): Promise<ServerScanResultPayload> {
  const startedAt = new Date();

  const execute = async (fs: RemoteFs) => {
    const inventory = await inventoryPaths(fs, connection.paths, scope);
    const issues: CoverageIssue[] = [...inventory.issues];

    const allowlist = parseExtensionAllowlist(scope.extensions);
    const classified = inventory.files.map((file) =>
      classifyFileByAllowlist(file, {
        maxFileSizeMb: MAX_FILE_SIZE_MB,
        isAllowed: (ext) => allowlist === null || allowlist.has(ext),
      }),
    );

    const eligible: FileEntry[] = [];
    let skippedCount = 0;
    let cappedCount = inventory.capped || inventory.timedOut ? 1 : 0;

    for (const decision of classified) {
      if (decision.status === "eligible") {
        eligible.push(decision.file);
        continue;
      }
      skippedCount += 1;
      issues.push({
        asset: decision.file.path,
        status: decision.status === "unsupported" ? "unsupported" : "skipped",
        reason: decision.reason,
        estimatedRecords: 1,
      });
    }

    const nameHits = triageInventory(inventory.files);
    const selected = selectFilesGeneric(eligible, nameHits, {
      coverageMode: scope.coverageMode,
      maxFiles: String(MAX_FILES_SAMPLE),
      prefer: "recent",
    });

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

    let scannedCount = 0;
    let sampledRecords = 0;
    let matchedRecords = 0;
    let partialCount = 0;
    const contentHits = new Map<string, Map<string, ContentFindingAggregate>>();

    for (const file of selected) {
      const maxBytes = Number(MAX_FILE_SIZE_MB) * 1024 * 1024;
      try {
        const buffer = await fs.read(file.path, { maxBytes });
        const window = windowLines(buffer, scope);

        if (window.lines.length === 0) {
          skippedCount += 1;
          issues.push({
            asset: file.path,
            status: "unsupported",
            reason: "Not decodable as text — likely binary content",
          });
          continue;
        }

        scannedCount += 1;
        sampledRecords += window.lines.length;
        if (window.capped) {
          partialCount += 1;
          issues.push({
            asset: file.path,
            status: "partial",
            reason: `Line-window sample of ${window.lines.length} of ${window.totalLines} lines`,
            sampledRecords: window.lines.length,
            estimatedRecords: window.totalLines,
          });
        }

        const detected = await detectPiiInValuesDetailed(window.lines);
        if (detected.size === 0) continue;
        const byType = new Map<string, ContentFindingAggregate>();
        for (const [piiType, detection] of detected) {
          matchedRecords += detection.matchedRecords;
          byType.set(piiType, {
            path: file.path,
            name: file.name,
            detection,
            sampledRecords: window.lines.length,
          });
        }
        contentHits.set(file.path, byType);
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to read file";
        const denied = /permission|denied|EACCES/i.test(message);
        skippedCount += 1;
        issues.push({
          asset: file.path,
          status: denied ? "permission_denied" : "skipped",
          reason: message,
        });
      }
    }

    const findings = mergeFileFindings(nameHits, contentHits, "server", "server_path");
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
        id: globalThis.crypto?.randomUUID?.() ?? `scan-${completedAt.getTime().toString(36)}`,
        connectorId: "server" as const,
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
      methodNote: `Path inventory (${connection.paths.length} path${
        connection.paths.length === 1 ? "" : "s"
      }) → extension filter → line-window sample (${scope.lineSample}) → OpenRedaction in-process.`,
    } satisfies ServerScanResultPayload;
  };

  if (options?.fs) {
    return execute(options.fs);
  }
  return withServerFs(connection, execute);
}

export function safeServerErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Scan failed";
  const message = error.message;
  if (/encrypted|passphrase required|Cannot parse privateKey/i.test(message)) {
    return "Private key needs a passphrase — enter the key passphrase";
  }
  if (/auth|password|permission denied|login|private key|All configured authentication methods failed/i.test(message)) {
    return "Authentication failed — check username, password, or SSH private key";
  }
  if (/ECONNREFUSED|ENOTFOUND|timeout|Timed out|connect/i.test(message)) {
    return "Could not connect to the host — check host, port, and network access";
  }
  if (/is required|Invalid/i.test(message)) {
    return message;
  }
  if (/No such file|ENOENT|not found/i.test(message)) {
    return "Path not found — check the paths to scan";
  }
  return "Scan failed — could not complete the server discovery run";
}
