import { archiveKindOf, listArchiveEntries } from "@/lib/discovery/backups/archive";
import { withBackupsFs } from "@/lib/discovery/backups/connect";
import {
  normalizeBackupsScopeValues,
  validateBackupsConnectionValues,
} from "@/lib/discovery/backups/connection-values";
import { inventoryRemoteFs } from "@/lib/discovery/file-server/inventory";
import {
  buildCoverageLine,
  buildCoverageSummary,
  mergeFileFindings,
  type ContentFindingAggregate,
} from "@/lib/discovery/file-server/pii-merge";
import {
  isUnsupportedExtension,
  selectFilesGeneric,
  triageInventory,
} from "@/lib/discovery/file-server/triage";
import { extractFileContent } from "@/lib/discovery/file-server/extract";
import type { CoverageIssue, FileEntry, RemoteFs } from "@/lib/discovery/file-server/types";
import { detectPiiInValuesDetailed } from "@/lib/discovery/pii-detectors";
import type {
  BackupsConnectionValues,
  BackupsScanResultPayload,
  BackupsScopeValues,
} from "@/lib/discovery/backups/types";
import {
  DETECTOR_VERSION,
  MAX_ARCHIVE_READ_BYTES,
  SCANNER_VERSION,
} from "@/lib/discovery/backups/types";

export { validateBackupsConnectionValues, normalizeBackupsScopeValues };

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export async function runBackupsScan(
  connection: BackupsConnectionValues,
  scope: BackupsScopeValues,
  options?: { fs?: RemoteFs },
): Promise<BackupsScanResultPayload> {
  const startedAt = new Date();

  const execute = async (fs: RemoteFs) => {
    const inventory = await inventoryRemoteFs(fs, connection.basePath || "/");
    const issues: CoverageIssue[] = [...inventory.issues];

    // Archive members are handled below via a dedicated archive reader, so
    // the generic "unsupported binary" allowlist (which excludes archives)
    // does not apply here — archives are the entire point of this connector.
    const maxArchiveBytes = Number(scope.maxArchiveSizeMb) * 1024 * 1024;
    const eligible: FileEntry[] = [];
    let skippedCount = 0;
    let cappedCount = inventory.capped || inventory.timedOut ? 1 : 0;

    for (const file of inventory.files) {
      const archiveKind = archiveKindOf(file.name);
      if (!archiveKind) continue; // not an archive coverage gap — silently out of scope
      if (file.size > maxArchiveBytes) {
        skippedCount += 1;
        issues.push({
          asset: file.path,
          status: "skipped",
          reason: `Archive exceeds ${scope.maxArchiveSizeMb} MB size limit`,
        });
        continue;
      }
      eligible.push(file);
    }

    const selected = selectFilesGeneric(eligible, [], {
      coverageMode: scope.coverageMode,
      maxFiles: scope.maxArchives,
      prefer: "recent",
    });

    if (scope.coverageMode === "sample" && eligible.length > selected.length) {
      cappedCount += 1;
      issues.push({
        asset: "archives",
        status: "capped",
        reason: `Archive sample limited to ${selected.length} of ${eligible.length} eligible archives`,
        sampledRecords: selected.length,
        estimatedRecords: eligible.length,
      });
    }

    let scannedArchives = 0;
    let sampledRecords = 0;
    let matchedRecords = 0;
    let partialCount = 0;
    const maxEntries = Math.max(1, Number(scope.maxEntriesPerArchive) || 200);
    const contentHits = new Map<string, Map<string, ContentFindingAggregate>>();
    const memberEntries: FileEntry[] = [];

    for (const archive of selected) {
      const maxBytes = Math.min(
        Number(scope.maxArchiveSizeMb) * 1024 * 1024,
        MAX_ARCHIVE_READ_BYTES,
      );
      let buffer: Buffer;
      try {
        buffer = await fs.read(archive.path, { maxBytes });
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to read archive";
        const denied = /permission|denied|EACCES/i.test(message);
        skippedCount += 1;
        issues.push({ asset: archive.path, status: denied ? "permission_denied" : "skipped", reason: message });
        continue;
      }

      const archiveKind = archiveKindOf(archive.name)!;
      let entries;
      try {
        entries = await listArchiveEntries(buffer, archiveKind);
      } catch (error) {
        const message = error instanceof Error ? error.message : "could not read archive";
        skippedCount += 1;
        issues.push({
          asset: archive.path,
          status: "unsupported",
          reason: /password|encrypt/i.test(message)
            ? "Archive is encrypted"
            : `Not a readable ${archiveKind}: ${message}`,
        });
        continue;
      }

      const fileEntries = entries.slice(0, maxEntries);
      if (entries.length > maxEntries) {
        partialCount += 1;
        issues.push({
          asset: archive.path,
          status: "partial",
          reason: `Archive member sample limited to ${maxEntries} of ${entries.length} entries`,
        });
      }

      scannedArchives += 1;

      for (const entry of fileEntries) {
        const ext = extensionOf(entry.name);
        const memberPath = `${archive.path}!${entry.name}`;
        const memberName = entry.name.split("/").filter(Boolean).pop() ?? entry.name;
        memberEntries.push({
          path: memberPath,
          name: memberName,
          ext,
          size: entry.size,
          mtimeMs: entry.mtimeMs,
        });

        if (isUnsupportedExtension(ext)) continue;

        let data: Buffer;
        try {
          data = entry.getData();
        } catch {
          issues.push({ asset: memberPath, status: "skipped", reason: "Could not read archive member (possibly password-protected)" });
          continue;
        }

        sampledRecords += 1;
        const extract = await extractFileContent(ext, data, { full: scope.coverageMode === "full" });
        if (extract.unsupported || extract.values.length === 0) continue;

        const detected = await detectPiiInValuesDetailed(extract.values);
        if (detected.size === 0) continue;
        const byType = contentHits.get(memberPath) ?? new Map<string, ContentFindingAggregate>();
        for (const [piiType, detection] of detected) {
          matchedRecords += detection.matchedRecords;
          byType.set(piiType, {
            path: memberPath,
            name: memberName,
            detection,
            sampledRecords: extract.sampledRecords,
            fieldHints: extract.fieldHints,
          });
        }
        contentHits.set(memberPath, byType);
      }
    }

    const nameHits = triageInventory(memberEntries);
    const findings = mergeFileFindings(nameHits, contentHits, "backups", "file");

    const coverage = buildCoverageSummary({
      discovered: eligible.length,
      scanned: scannedArchives,
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
        connectorId: "backups" as const,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        scannerVersion: SCANNER_VERSION,
        detectorVersion: DETECTOR_VERSION,
        mode,
      },
      scopeLabel: "Archives inventoried",
      scopeValue: eligible.length,
      findings,
      coverage,
      coverageIssues: issues,
      coverageLine: buildCoverageLine(coverage, issues),
      methodNote: `Path inventory → archive triage (.zip / .tar / .tar.gz) → member extraction (${mode}) → OpenRedaction in-process. 7z/rar archives are not yet supported.`,
    } satisfies BackupsScanResultPayload;
  };

  if (options?.fs) {
    return execute(options.fs);
  }
  return withBackupsFs(connection, execute);
}

export function safeBackupsScanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Scan failed";
  const message = error.message;
  if (/encrypted|passphrase required|Cannot parse privateKey/i.test(message)) {
    return "Private key needs a passphrase — enter the key passphrase";
  }
  if (/auth|password|permission denied|login|private key/i.test(message)) {
    return "Authentication failed — check username, password, or SSH private key";
  }
  if (/ECONNREFUSED|ENOTFOUND|timeout|connect/i.test(message)) {
    return "Could not connect to the host — check host, port/share, and network access";
  }
  if (/is required|Invalid/i.test(message)) return message;
  if (/No such file|ENOENT|not found|Path not found/i.test(message)) {
    return "Path not found — check the base path";
  }
  return "Scan failed — could not complete the backups discovery run";
}
