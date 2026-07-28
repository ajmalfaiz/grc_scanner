import { describe, expect, it } from "vitest";

import {
  classifyFile,
  selectFilesForContent,
  triageFilePath,
} from "@/lib/discovery/file-server/triage";
import type { FileEntry } from "@/lib/discovery/file-server/types";

const scope = {
  coverageMode: "sample" as const,
  fileTypes: "office_text" as const,
  maxFileSizeMb: "1",
  maxFiles: "2",
  prefer: "recent" as const,
};

function file(partial: Partial<FileEntry> & { path: string; name: string }): FileEntry {
  return {
    ext: partial.ext ?? partial.name.split(".").pop()?.toLowerCase() ?? "",
    size: partial.size ?? 10,
    mtimeMs: partial.mtimeMs ?? 0,
    ...partial,
  };
}

describe("file-server triage", () => {
  it("classifies allowlisted, unsupported, and oversized files", () => {
    expect(
      classifyFile(file({ path: "/a.csv", name: "a.csv", size: 10 }), scope)
        .status,
    ).toBe("eligible");
    expect(
      classifyFile(file({ path: "/dump.sql", name: "dump.sql", size: 10 }), scope)
        .status,
    ).toBe("eligible");
    expect(
      classifyFile(file({ path: "/a.zip", name: "a.zip", size: 10 }), scope)
        .status,
    ).toBe("unsupported");
    expect(
      classifyFile(
        file({ path: "/big.csv", name: "big.csv", size: 2 * 1024 * 1024 }),
        scope,
      ).status,
    ).toBe("oversized");
  });

  it("in all mode, attempts any non-unsupported file including no extension", () => {
    const allScope = { ...scope, fileTypes: "all" as const };
    expect(
      classifyFile(file({ path: "/export", name: "export", ext: "" }), allScope)
        .status,
    ).toBe("eligible");
    expect(
      classifyFile(file({ path: "/notes.bak", name: "notes.bak", ext: "bak" }), allScope)
        .status,
    ).toBe("eligible");
    expect(
      classifyFile(file({ path: "/pic.png", name: "pic.png", ext: "png" }), allScope)
        .status,
    ).toBe("unsupported");
  });

  it("scores sensitive path names", () => {
    const hits = triageFilePath(
      file({ path: "/hr/onboarding/employee-master.xlsx", name: "employee-master.xlsx" }),
    );
    expect(hits.some((hit) => hit.piiType === "Person name")).toBe(true);
    expect(hits.some((hit) => hit.piiType === "Aadhaar")).toBe(false);

    const aadhaarHits = triageFilePath(
      file({ path: "/kyc/aadhaar-scan.pdf", name: "aadhaar-scan.pdf" }),
    );
    expect(aadhaarHits.some((hit) => hit.piiType === "Aadhaar")).toBe(true);
  });

  it("selects recent files within maxFiles", () => {
    const selected = selectFilesForContent(
      [
        file({ path: "/old.csv", name: "old.csv", mtimeMs: 1 }),
        file({ path: "/new.csv", name: "new.csv", mtimeMs: 100 }),
        file({ path: "/mid.csv", name: "mid.csv", mtimeMs: 50 }),
      ],
      [],
      scope,
    );
    expect(selected.map((item) => item.path)).toEqual(["/new.csv", "/mid.csv"]);
  });
});
