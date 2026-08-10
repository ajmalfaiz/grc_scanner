import { describe, expect, it } from "vitest";

import { flattenDocument, mergeFieldMaps } from "@/lib/discovery/mongodb/flatten";

describe("flattenDocument", () => {
  it("flattens nested objects into dotted field paths", () => {
    const map = flattenDocument(
      {
        _id: "abc",
        email: "a@example.com",
        profile: { phone: "+91 98765 43210", address: { city: "Pune" } },
      },
      3,
    );

    expect(map.get("email")).toEqual(["a@example.com"]);
    expect(map.get("profile.phone")).toEqual(["+91 98765 43210"]);
    expect(map.get("profile.address.city")).toEqual(["Pune"]);
    expect(map.has("_id")).toBe(false);
  });

  it("stops recursing past maxDepth and samples object arrays", () => {
    const map = flattenDocument(
      {
        contacts: [{ email: "a@example.com" }, { email: "b@example.com" }],
        tags: ["vip", "beta"],
      },
      2,
    );

    expect(map.get("contacts[].email")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(map.get("tags")).toEqual([["vip", "beta"]]);
  });

  it("merges multiple document field maps", () => {
    const merged = mergeFieldMaps([
      flattenDocument({ email: "a@example.com" }, 3),
      flattenDocument({ email: "b@example.com" }, 3),
    ]);
    expect(merged.get("email")).toEqual(["a@example.com", "b@example.com"]);
  });
});
