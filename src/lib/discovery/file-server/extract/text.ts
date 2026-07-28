import type { FileExtractResult } from "@/lib/discovery/file-server/types";
import {
  MAX_CSV_ROWS_FULL,
  MAX_CSV_ROWS_SAMPLE,
  MAX_EXTRACT_CHARS,
} from "@/lib/discovery/file-server/types";

function decodeUtf8(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

/** Null bytes or a high share of C0 controls → treat as non-text. */
export function isLikelyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sampleLen = Math.min(buffer.length, 8192);
  let suspicious = 0;
  for (let i = 0; i < sampleLen; i += 1) {
    const byte = buffer[i];
    if (byte === 0) return true;
    // Allow tab (9), LF (10), CR (13); flag other C0 controls.
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      suspicious += 1;
    }
  }
  return suspicious / sampleLen > 0.3;
}

function truncateText(text: string): { text: string; capped: boolean } {
  if (text.length <= MAX_EXTRACT_CHARS) {
    return { text, capped: false };
  }
  return { text: text.slice(0, MAX_EXTRACT_CHARS), capped: true };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function extractPlainText(buffer: Buffer): FileExtractResult {
  const decoded = decodeUtf8(buffer);
  const { text, capped } = truncateText(decoded);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    values: lines.length > 0 ? lines : text ? [text] : [],
    sampledRecords: lines.length > 0 ? lines.length : text ? 1 : 0,
    capped,
    partial: false,
    unsupported: false,
  };
}

/** Plain-text extract that skips binary payloads (used for .sql and catch-all). */
export function extractPlainTextOrUnsupported(buffer: Buffer): FileExtractResult {
  if (isLikelyBinary(buffer)) {
    return {
      values: [],
      sampledRecords: 0,
      capped: false,
      partial: false,
      unsupported: true,
      reason: "Binary or non-text content",
    };
  }
  return extractPlainText(buffer);
}

export function extractDelimitedText(
  buffer: Buffer,
  options: { delimiter: string; full: boolean },
): FileExtractResult {
  const decoded = decodeUtf8(buffer);
  const { text, capped: charCapped } = truncateText(decoded);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rowLimit = options.full ? MAX_CSV_ROWS_FULL : MAX_CSV_ROWS_SAMPLE;
  const selected = lines.slice(0, rowLimit);
  const values: string[] = [];
  let headers: string[] = [];

  selected.forEach((line, index) => {
    const cells = splitCsvLine(line, options.delimiter);
    if (index === 0) {
      headers = cells;
    }
    for (const cell of cells) {
      if (cell) values.push(cell);
    }
  });

  return {
    values,
    sampledRecords: selected.length,
    capped: charCapped || lines.length > rowLimit,
    partial: false,
    unsupported: false,
    fieldHints: headers
      .filter(Boolean)
      .map((name, index) => ({
        name,
        path: `col:${index}:${name}`,
      })),
  };
}
