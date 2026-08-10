import { describe, expect, it } from "vitest";

import {
  buildCollectionMatcher,
  resolveMaxDepth,
  validateMongoConnectionValues,
} from "@/lib/discovery/mongodb/connection-values";

describe("mongo connection-values", () => {
  it("requires host, username, database", () => {
    expect(() => validateMongoConnectionValues({})).toThrow(/host is required/);
  });

  it("defaults port, authSource, tls", () => {
    const values = validateMongoConnectionValues({
      host: "mongo.internal",
      username: "reader",
      database: "customers",
    });
    expect(values.port).toBe("27017");
    expect(values.authSource).toBe("admin");
    expect(values.tls).toBe("true");
  });
});

describe("buildCollectionMatcher", () => {
  it("matches everything when blank", () => {
    const matcher = buildCollectionMatcher(undefined);
    expect(matcher("anything")).toBe(true);
  });

  it("matches comma-separated glob patterns", () => {
    const matcher = buildCollectionMatcher("customers*, kyc*");
    expect(matcher("customers_2024")).toBe(true);
    expect(matcher("kyc_uploads")).toBe(true);
    expect(matcher("sessions")).toBe(false);
  });
});

describe("resolveMaxDepth", () => {
  it("caps unlimited and invalid input", () => {
    expect(resolveMaxDepth("unlimited")).toBe(20);
    expect(resolveMaxDepth("3")).toBe(3);
    expect(resolveMaxDepth("nope")).toBe(3);
  });
});
