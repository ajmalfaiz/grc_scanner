import { describe, expect, it } from "vitest";

import {
  extractDelimitedText,
  extractPlainText,
  extractPlainTextOrUnsupported,
  isLikelyBinary,
} from "@/lib/discovery/file-server/extract/text";

describe("text extractors", () => {
  it("extracts plain text lines", () => {
    const result = extractPlainText(
      Buffer.from("alice@example.com\nphone 555\n"),
    );
    expect(result.values).toEqual(["alice@example.com", "phone 555"]);
    expect(result.sampledRecords).toBe(2);
  });

  it("extracts csv cells and headers", () => {
    const result = extractDelimitedText(
      Buffer.from("email,name\nalice@example.com,Alice\nbob@example.com,Bob\n"),
      { delimiter: ",", full: false },
    );
    expect(result.values).toContain("alice@example.com");
    expect(result.fieldHints?.[0]?.name).toBe("email");
    expect(result.sampledRecords).toBe(3);
  });

  it("extracts sql dump lines and rejects binary buffers", () => {
    const sql = extractPlainTextOrUnsupported(
      Buffer.from(
        "INSERT INTO users VALUES ('alice@example.com');\n-- dump\n",
      ),
    );
    expect(sql.unsupported).toBe(false);
    expect(sql.values.some((value) => value.includes("alice@example.com"))).toBe(
      true,
    );

    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    expect(isLikelyBinary(binary)).toBe(true);
    expect(extractPlainTextOrUnsupported(binary).unsupported).toBe(true);
  });
});
