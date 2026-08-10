import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  RemoteDirEntry,
  RemoteFs,
  RemoteFsTestResult,
  RemoteStat,
} from "@/lib/discovery/file-server/types";

/**
 * RemoteFs implementation over the local filesystem reachable by this Node
 * process (a mounted backup share, a bind-mounted volume, or a plain local
 * path). Genuinely reads real files — no network protocol involved.
 */
export async function openLocalFs(root: string): Promise<RemoteFs> {
  const resolvedRoot = path.resolve(root || "/");
  const rootStat = await fs.stat(resolvedRoot).catch((error) => {
    throw new Error(
      error?.code === "ENOENT"
        ? `Path not found: ${resolvedRoot}`
        : `Cannot access path: ${resolvedRoot}`,
    );
  });
  if (!rootStat.isDirectory()) {
    throw new Error(`Base path is not a directory: ${resolvedRoot}`);
  }

  return {
    async test(): Promise<RemoteFsTestResult> {
      const entries = await fs.readdir(resolvedRoot);
      return {
        message: `Connected to local path ${resolvedRoot}`,
        details: {
          protocol: "local",
          root: resolvedRoot,
          entries: String(entries.length),
        },
      };
    },

    async listDir(dirPath: string): Promise<RemoteDirEntry[]> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const results: RemoteDirEntry[] = [];
      for (const entry of entries) {
        const childPath = path.join(dirPath, entry.name);
        let isDirectory = entry.isDirectory();
        let size = 0;
        let mtimeMs = 0;
        try {
          if (entry.isSymbolicLink()) {
            const stat = await fs.stat(childPath);
            isDirectory = stat.isDirectory();
            size = stat.size;
            mtimeMs = stat.mtimeMs;
          } else {
            const stat = await fs.stat(childPath);
            size = stat.size;
            mtimeMs = stat.mtimeMs;
          }
        } catch {
          // Broken symlink or permission issue — treat as an empty file so
          // the walk continues; classify() will surface the real error on read.
        }
        results.push({ name: entry.name, path: childPath, isDirectory, size, mtimeMs });
      }
      return results;
    },

    async stat(statPath: string): Promise<RemoteStat> {
      const info = await fs.stat(statPath);
      return {
        path: statPath,
        isDirectory: info.isDirectory(),
        size: info.size,
        mtimeMs: info.mtimeMs,
      };
    },

    async read(readPath: string, opts: { maxBytes: number }): Promise<Buffer> {
      const handle = await fs.open(readPath, "r");
      try {
        const stat = await handle.stat();
        const length = Math.min(stat.size, opts.maxBytes);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, 0);
        return buffer;
      } finally {
        await handle.close();
      }
    },

    async close(): Promise<void> {
      // No persistent handle to release.
    },
  };
}
