import { extractFileContent } from "@/lib/discovery/file-server/extract";
import type {
  FileEntry,
  FileExtractResult,
  FileServerScopeValues,
  RemoteFs,
} from "@/lib/discovery/file-server/types";
import { MAX_READ_BYTES } from "@/lib/discovery/file-server/types";

export type SampledFile = {
  file: FileEntry;
  extract: FileExtractResult;
  readError?: string;
};

function readBudgetForExt(ext: string, maxFileBytes: number): number {
  const hardCap = Math.min(MAX_READ_BYTES, maxFileBytes);
  if (ext === "pdf" || ext === "docx" || ext === "xlsx" || ext === "xls") {
    return hardCap;
  }
  return Math.min(hardCap, 2 * 1024 * 1024);
}

export async function sampleFileContent(
  fs: RemoteFs,
  file: FileEntry,
  scope: FileServerScopeValues,
): Promise<SampledFile> {
  const maxFileBytes = Number(scope.maxFileSizeMb) * 1024 * 1024;
  const maxBytes = readBudgetForExt(file.ext, maxFileBytes);

  try {
    const buffer = await fs.read(file.path, { maxBytes });
    const extract = await extractFileContent(file.ext, buffer, {
      full: scope.coverageMode === "full",
    });
    return { file, extract };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to read file";
    return {
      file,
      extract: {
        values: [],
        sampledRecords: 0,
        capped: false,
        partial: false,
        unsupported: false,
        reason: message,
      },
      readError: message,
    };
  }
}
