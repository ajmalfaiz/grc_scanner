import { describe, expect, it } from "vitest";

import { archiveKindOf } from "@/lib/discovery/backups/archive";

describe("archiveKindOf", () => {
  it("detects zip, tar, and tar.gz (including .tgz)", () => {
    expect(archiveKindOf("nightly.zip")).toBe("zip");
    expect(archiveKindOf("nightly.tar")).toBe("tar");
    expect(archiveKindOf("nightly.tar.gz")).toBe("tar.gz");
    expect(archiveKindOf("nightly.tgz")).toBe("tar.gz");
  });

  it("returns null for non-archive files", () => {
    expect(archiveKindOf("notes.txt")).toBeNull();
    expect(archiveKindOf("data.gz")).toBeNull();
  });
});
