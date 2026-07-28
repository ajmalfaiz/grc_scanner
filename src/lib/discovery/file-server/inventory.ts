import {
  basenameRemote,
  extensionOf,
} from "@/lib/discovery/file-server/connection-values";
import type {
  CoverageIssue,
  FileEntry,
  RemoteFs,
} from "@/lib/discovery/file-server/types";
import {
  MAX_INVENTORY_FILES,
  MAX_WALK_DEPTH,
  WALK_TIMEOUT_MS,
} from "@/lib/discovery/file-server/types";

export type InventoryResult = {
  files: FileEntry[];
  issues: CoverageIssue[];
  capped: boolean;
  timedOut: boolean;
};

export async function inventoryRemoteFs(
  fs: RemoteFs,
  rootPath: string,
  options?: {
    maxFiles?: number;
    maxDepth?: number;
    timeoutMs?: number;
  },
): Promise<InventoryResult> {
  const maxFiles = options?.maxFiles ?? MAX_INVENTORY_FILES;
  const maxDepth = options?.maxDepth ?? MAX_WALK_DEPTH;
  const timeoutMs = options?.timeoutMs ?? WALK_TIMEOUT_MS;
  const started = Date.now();

  const files: FileEntry[] = [];
  const issues: CoverageIssue[] = [];
  let capped = false;
  let timedOut = false;

  type QueueItem = { path: string; depth: number };
  const queue: QueueItem[] = [{ path: rootPath || "/", depth: 0 }];

  while (queue.length > 0) {
    if (Date.now() - started > timeoutMs) {
      timedOut = true;
      issues.push({
        asset: "inventory",
        status: "timeout",
        reason: `Directory walk timed out after ${Math.round(timeoutMs / 1000)}s`,
      });
      break;
    }

    const current = queue.shift();
    if (!current) break;

    if (current.depth > maxDepth) {
      issues.push({
        asset: current.path,
        status: "capped",
        reason: `Max directory depth ${maxDepth} reached`,
      });
      continue;
    }

    let entries;
    try {
      entries = await fs.listDir(current.path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "list directory failed";
      const denied = /permission|denied|EACCES|403/i.test(message);
      issues.push({
        asset: current.path,
        status: denied ? "permission_denied" : "skipped",
        reason: denied ? "permission denied" : message,
      });
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory) {
        queue.push({ path: entry.path, depth: current.depth + 1 });
        continue;
      }

      if (files.length >= maxFiles) {
        capped = true;
        break;
      }

      const name = entry.name || basenameRemote(entry.path);
      files.push({
        path: entry.path,
        name,
        ext: extensionOf(name),
        size: entry.size,
        mtimeMs: entry.mtimeMs,
      });
    }

    if (capped) {
      issues.push({
        asset: "inventory",
        status: "capped",
        reason: `Inventory limited to first ${maxFiles} files`,
      });
      break;
    }
  }

  return { files, issues, capped, timedOut };
}
