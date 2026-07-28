import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { extractSpreadsheet } from "@/lib/discovery/file-server/extract/xlsx";

describe("xlsx extractor", () => {
  it("extracts cell strings from a workbook buffer", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["email", "name"],
      ["alice@example.com", "Alice"],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = extractSpreadsheet(buffer);
    expect(result.unsupported).toBe(false);
    expect(result.values).toContain("alice@example.com");
    expect(result.fieldHints?.[0]?.name).toBe("email");
  });
});
