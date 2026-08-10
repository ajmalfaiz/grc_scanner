import zlib from "node:zlib";
import { Readable } from "node:stream";

import AdmZip from "adm-zip";
import * as tar from "tar-stream";

export type ArchiveKind = "zip" | "tar" | "tar.gz";

export type ArchiveEntry = {
  name: string;
  size: number;
  mtimeMs: number;
  getData: () => Buffer;
};

/** Detect archive kind from a filename — handles the .tar.gz double extension. */
export function archiveKindOf(name: string): ArchiveKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".tar")) return "tar";
  return null;
}

function listZipEntries(buffer: Buffer): ArchiveEntry[] {
  const entries = new AdmZip(buffer).getEntries();
  return entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      name: entry.entryName,
      size: entry.header.size,
      mtimeMs: entry.header.time?.getTime?.() ?? 0,
      getData: () => entry.getData(),
    }));
}

async function listTarEntries(buffer: Buffer, gzip: boolean): Promise<ArchiveEntry[]> {
  const input = gzip ? zlib.gunzipSync(buffer) : buffer;

  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    const entries: ArchiveEntry[] = [];

    extract.on("entry", (header, stream, next) => {
      if (header.type !== "file") {
        stream.resume();
        next();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        const data = Buffer.concat(chunks);
        entries.push({
          name: header.name,
          size: header.size ?? data.length,
          mtimeMs: header.mtime?.getTime?.() ?? 0,
          getData: () => data,
        });
        next();
      });
      stream.on("error", reject);
      stream.resume();
    });

    extract.on("finish", () => resolve(entries));
    extract.on("error", reject);

    Readable.from(input).pipe(extract);
  });
}

/**
 * List readable members of a .zip / .tar / .tar.gz archive without writing
 * anything to disk. Throws on corrupt/encrypted/unreadable archives.
 */
export async function listArchiveEntries(
  buffer: Buffer,
  kind: ArchiveKind,
): Promise<ArchiveEntry[]> {
  if (kind === "zip") return listZipEntries(buffer);
  return listTarEntries(buffer, kind === "tar.gz");
}
