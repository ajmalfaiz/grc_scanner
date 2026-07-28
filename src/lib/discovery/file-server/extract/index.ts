import { extractDocx } from "@/lib/discovery/file-server/extract/docx";
import { extractPdf } from "@/lib/discovery/file-server/extract/pdf";
import {
  extractDelimitedText,
  extractPlainTextOrUnsupported,
} from "@/lib/discovery/file-server/extract/text";
import { extractSpreadsheet } from "@/lib/discovery/file-server/extract/xlsx";
import type { FileExtractResult } from "@/lib/discovery/file-server/types";

export async function extractFileContent(
  ext: string,
  buffer: Buffer,
  options: { full: boolean },
): Promise<FileExtractResult> {
  switch (ext) {
    case "csv":
      return extractDelimitedText(buffer, { delimiter: ",", full: options.full });
    case "tsv":
      return extractDelimitedText(buffer, { delimiter: "\t", full: options.full });
    case "xlsx":
    case "xls":
      return extractSpreadsheet(buffer);
    case "docx":
      return extractDocx(buffer);
    case "pdf":
      return extractPdf(buffer);
    case "txt":
    case "md":
    case "log":
    case "json":
    case "jsonl":
    case "ndjson":
    case "xml":
    case "html":
    case "htm":
    case "sql":
    case "yaml":
    case "yml":
    case "eml":
    case "rtf":
    case "env":
    case "ini":
    case "conf":
    case "cfg":
    case "properties":
    case "toml":
      return extractPlainTextOrUnsupported(buffer);
    default:
      // Catch-all for `fileTypes: all` — try UTF-8 text, skip binaries.
      return extractPlainTextOrUnsupported(buffer);
  }
}
