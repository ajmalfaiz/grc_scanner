import mammoth from "mammoth";

import type { FileExtractResult } from "@/lib/discovery/file-server/types";
import { MAX_EXTRACT_CHARS } from "@/lib/discovery/file-server/types";

export async function extractDocx(buffer: Buffer): Promise<FileExtractResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? "").trim();
    if (!text) {
      return {
        values: [],
        sampledRecords: 0,
        capped: false,
        partial: true,
        unsupported: false,
        reason: "DOCX contained no extractable text",
      };
    }

    const capped = text.length > MAX_EXTRACT_CHARS;
    const clipped = capped ? text.slice(0, MAX_EXTRACT_CHARS) : text;
    const paragraphs = clipped
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      values: paragraphs,
      sampledRecords: paragraphs.length,
      capped,
      partial: false,
      unsupported: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "DOCX parse failed";
    return {
      values: [],
      sampledRecords: 0,
      capped: false,
      partial: false,
      unsupported: true,
      reason: message,
    };
  }
}
