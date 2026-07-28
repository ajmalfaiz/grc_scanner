import smb2 from "@awo00/smb2";

import {
  basenameRemote,
  joinRemotePath,
} from "@/lib/discovery/file-server/connection-values";
import type {
  FileServerConnectionValues,
  RemoteDirEntry,
  RemoteFs,
  RemoteFsTestResult,
  RemoteStat,
} from "@/lib/discovery/file-server/types";
import { CONNECT_TIMEOUT_MS } from "@/lib/discovery/file-server/types";

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function normalizeSmbPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.replace(/^\/+/, "").replace(/\//g, "\\");
}

export async function openSmbFs(
  connection: FileServerConnectionValues,
): Promise<RemoteFs> {
  const shareName = connection.shareName?.trim();
  if (!shareName) {
    throw new Error("shareName is required");
  }

  const client = new smb2.Client(connection.host, {
    connectTimeout: CONNECT_TIMEOUT_MS,
    requestTimeout: CONNECT_TIMEOUT_MS,
  });
  await client.connect();

  const session = await client.authenticate({
    domain: connection.domain?.trim() || "WORKGROUP",
    username: connection.username,
    password: connection.password,
  });

  const tree = await session.connectTree(shareName);
  const root = connection.basePath || "/";

  async function listDir(path: string): Promise<RemoteDirEntry[]> {
    const smbPath = normalizeSmbPath(path);
    const listing = await tree.readDirectory(smbPath || undefined);
    return listing
      .filter((entry) => entry.filename !== "." && entry.filename !== "..")
      .map((entry) => {
        const name = entry.filename;
        return {
          name,
          path: joinRemotePath(path === "/" ? "/" : path, name),
          isDirectory: entry.type === "Directory",
          size: toNumber(entry.fileSize),
          mtimeMs: entry.lastWriteTime?.getTime?.() ?? 0,
        };
      });
  }

  return {
    async test(): Promise<RemoteFsTestResult> {
      const smbRoot = normalizeSmbPath(root);
      const listing = await tree.readDirectory(smbRoot || undefined);
      return {
        message: `Connected via SMB to \\\\${connection.host}\\${shareName}`,
        details: {
          protocol: "smb",
          host: connection.host,
          shareName,
          root,
          entries: String(listing.length),
        },
      };
    },

    listDir,

    async stat(path: string): Promise<RemoteStat> {
      const parent =
        path === "/"
          ? "/"
          : path.replace(/\/[^/]+$/, "") || "/";
      const name = basenameRemote(path);
      if (!name) {
        return {
          path,
          isDirectory: true,
          size: 0,
          mtimeMs: 0,
        };
      }
      const entries = await listDir(parent);
      const match = entries.find((entry) => entry.name === name);
      if (!match) {
        throw new Error(`Path not found: ${path}`);
      }
      return {
        path,
        isDirectory: match.isDirectory,
        size: match.size,
        mtimeMs: match.mtimeMs,
      };
    },

    async read(path: string, opts: { maxBytes: number }): Promise<Buffer> {
      const smbPath = normalizeSmbPath(path);
      const buffer = await tree.readFile(smbPath);
      if (buffer.length <= opts.maxBytes) return Buffer.from(buffer);
      return Buffer.from(buffer.subarray(0, opts.maxBytes));
    },

    async close(): Promise<void> {
      try {
        await tree.disconnect();
      } catch {
        // ignore
      }
      try {
        await session.logoff();
      } catch {
        // ignore
      }
      try {
        await client.close();
      } catch {
        // ignore
      }
    },
  };
}
