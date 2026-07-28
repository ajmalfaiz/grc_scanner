import type {
  RemoteDirEntry,
  RemoteFs,
  RemoteFsTestResult,
  RemoteStat,
} from "@/lib/discovery/file-server/types";
import { joinRemotePath } from "@/lib/discovery/file-server/connection-values";

export type MemoryNode =
  | { type: "dir"; children: Record<string, MemoryNode> }
  | { type: "file"; content: Buffer; mtimeMs?: number };

function getNode(root: MemoryNode, path: string): MemoryNode | null {
  if (path === "/" || path === "") return root;
  const parts = path.split("/").filter(Boolean);
  let current: MemoryNode = root;
  for (const part of parts) {
    if (current.type !== "dir") return null;
    const next = current.children[part];
    if (!next) return null;
    current = next;
  }
  return current;
}

export function createMemoryRemoteFs(
  root: MemoryNode,
  options?: { denyPaths?: Set<string> },
): RemoteFs {
  const denyPaths = options?.denyPaths ?? new Set<string>();

  return {
    async test(): Promise<RemoteFsTestResult> {
      if (root.type !== "dir") {
        throw new Error("Root is not a directory");
      }
      return {
        message: "Connected via memory fs",
        details: {
          protocol: "memory",
          entries: String(Object.keys(root.children).length),
        },
      };
    },

    async listDir(path: string): Promise<RemoteDirEntry[]> {
      if (denyPaths.has(path)) {
        throw new Error("permission denied");
      }
      const node = getNode(root, path);
      if (!node || node.type !== "dir") {
        throw new Error(`Not a directory: ${path}`);
      }
      return Object.entries(node.children).map(([name, child]) => ({
        name,
        path: joinRemotePath(path, name),
        isDirectory: child.type === "dir",
        size: child.type === "file" ? child.content.length : 0,
        mtimeMs: child.type === "file" ? (child.mtimeMs ?? 0) : 0,
      }));
    },

    async stat(path: string): Promise<RemoteStat> {
      const node = getNode(root, path);
      if (!node) throw new Error(`Path not found: ${path}`);
      return {
        path,
        isDirectory: node.type === "dir",
        size: node.type === "file" ? node.content.length : 0,
        mtimeMs: node.type === "file" ? (node.mtimeMs ?? 0) : 0,
      };
    },

    async read(path: string, opts: { maxBytes: number }): Promise<Buffer> {
      if (denyPaths.has(path)) {
        throw new Error("permission denied");
      }
      const node = getNode(root, path);
      if (!node || node.type !== "file") {
        throw new Error(`Not a file: ${path}`);
      }
      if (node.content.length <= opts.maxBytes) return Buffer.from(node.content);
      return Buffer.from(node.content.subarray(0, opts.maxBytes));
    },

    async close(): Promise<void> {
      // no-op
    },
  };
}
