import pdfParse from "pdf-parse";

import type { FileExtractResult } from "@/lib/discovery/file-server/types";
import {
  MAX_EXTRACT_CHARS,
  MAX_PDF_PAGES,
} from "@/lib/discovery/file-server/types";

export async function extractPdf(buffer: Buffer): Promise<FileExtractResult> {
  try {
    const result = await pdfParse(buffer, { max: MAX_PDF_PAGES });
    const text = (result.text ?? "").trim();
    if (!text) {
      return {
        values: [],
        sampledRecords: 0,
        capped: false,
        partial: true,
        unsupported: true,
        reason: "image-only or encrypted PDF (no extractable text)",
      };
    }

    const capped =
      text.length > MAX_EXTRACT_CHARS ||
      (typeof result.numpages === "number" && result.numpages > MAX_PDF_PAGES);
    const clipped = text.length > MAX_EXTRACT_CHARS
      ? text.slice(0, MAX_EXTRACT_CHARS)
      : text;
    const chunks = clipped
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      values: chunks,
      sampledRecords: chunks.length,
      capped,
      partial: false,
      unsupported: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parse failed";
    const encrypted = /password|encrypt/i.test(message);
    return {
      values: [],
      sampledRecords: 0,
      capped: false,
      partial: false,
      unsupported: true,
      reason: encrypted
        ? "encrypted PDF"
        : message,
    };
  }
}
