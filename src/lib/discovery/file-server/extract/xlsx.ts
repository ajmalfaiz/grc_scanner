import * as XLSX from "xlsx";

import type { FileExtractResult } from "@/lib/discovery/file-server/types";
import { MAX_XLSX_CELLS } from "@/lib/discovery/file-server/types";

export function extractSpreadsheet(buffer: Buffer): FileExtractResult {
  try {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      dense: false,
    });
    const values: string[] = [];
    const fieldHints: Array<{ name: string; path: string }> = [];
    let sampledRecords = 0;
    let capped = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
        sheet,
        {
          header: 1,
          raw: false,
          defval: "",
        },
      );

      rows.forEach((row, rowIndex) => {
        if (!Array.isArray(row)) return;
        sampledRecords += 1;
        row.forEach((cell, colIndex) => {
          if (values.length >= MAX_XLSX_CELLS) {
            capped = true;
            return;
          }
          const text = String(cell ?? "").trim();
          if (!text) return;
          values.push(text);
          if (rowIndex === 0) {
            fieldHints.push({
              name: text,
              path: `${sheetName}!col${colIndex}`,
            });
          }
        });
      });

      if (capped) break;
    }

    return {
      values,
      sampledRecords,
      capped,
      partial: false,
      unsupported: false,
      fieldHints,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "spreadsheet parse failed";
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
