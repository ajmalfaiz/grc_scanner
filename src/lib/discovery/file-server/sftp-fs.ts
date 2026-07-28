import SftpClient from "ssh2-sftp-client";

import { joinRemotePath } from "@/lib/discovery/file-server/connection-values";
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
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mtimeMsFrom(entry: {
  modifyTime?: number;
  attrs?: { mtime?: number };
}): number {
  if (typeof entry.modifyTime === "number") return entry.modifyTime;
  if (typeof entry.attrs?.mtime === "number") {
    // ssh2 attrs.mtime is often seconds
    return entry.attrs.mtime > 1e12
      ? entry.attrs.mtime
      : entry.attrs.mtime * 1000;
  }
  return 0;
}

export async function openSftpFs(
  connection: FileServerConnectionValues,
): Promise<RemoteFs> {
  const client = new SftpClient();
  const port = Number(connection.port ?? "22");
  const root = connection.basePath || "/";

  await client.connect({
    host: connection.host,
    port,
    username: connection.username,
    readyTimeout: CONNECT_TIMEOUT_MS,
    ...(connection.authMethod === "privateKey" && connection.privateKey
      ? {
          privateKey: connection.privateKey,
          ...(connection.passphrase
            ? { passphrase: connection.passphrase }
            : {}),
        }
      : {
          password: connection.password,
        }),
  });

  return {
    async test(): Promise<RemoteFsTestResult> {
      const listing = await client.list(root);
      return {
        message: `Connected via SFTP to ${connection.host}:${port}`,
        details: {
          protocol: "sftp",
          host: connection.host,
          port: String(port),
          root,
          entries: String(listing.length),
        },
      };
    },

    async listDir(path: string): Promise<RemoteDirEntry[]> {
      const listing = await client.list(path);
      return listing.map((entry) => {
        const name = entry.name;
        const childPath = joinRemotePath(path, name);
        const type = String(entry.type ?? "");
        const isDirectory = type === "d";
        return {
          name,
          path: childPath,
          isDirectory,
          size: toNumber(entry.size),
          mtimeMs: mtimeMsFrom(entry),
        };
      });
    },

    async stat(path: string): Promise<RemoteStat> {
      const info = await client.stat(path);
      const modifyTime = toNumber(info.modifyTime);
      return {
        path,
        isDirectory: Boolean(info.isDirectory),
        size: toNumber(info.size),
        mtimeMs:
          modifyTime > 1e12 ? modifyTime : modifyTime > 0 ? modifyTime * 1000 : 0,
      };
    },

    async read(path: string, opts: { maxBytes: number }): Promise<Buffer> {
      const buffer = (await client.get(path)) as Buffer;
      if (buffer.length <= opts.maxBytes) return buffer;
      return buffer.subarray(0, opts.maxBytes);
    },

    async close(): Promise<void> {
      try {
        await client.end();
      } catch {
        // ignore close errors
      }
    },
  };
}
