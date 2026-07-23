import { describe, expect, it } from "vitest";

import {
  formatDatabaseList,
  parseDatabaseList,
  resolveBootstrapDatabase,
  resolvePostgresDatabaseSelection,
} from "@/lib/discovery/postgres/databases";

describe("postgres database selection helpers", () => {
  it("parses and formats database lists", () => {
    expect(parseDatabaseList(" hr, analytics, hr ")).toEqual([
      "hr",
      "analytics",
    ]);
    expect(formatDatabaseList(["hr", "analytics"])).toBe("hr, analytics");
  });

  it("treats a legacy database field as selected mode", () => {
    expect(
      resolvePostgresDatabaseSelection({
        database: "app",
      }),
    ).toEqual({ mode: "selected", databases: ["app"] });
  });

  it("supports all-databases mode", () => {
    expect(
      resolvePostgresDatabaseSelection({
        databaseMode: "all",
        databases: "hr, analytics",
      }),
    ).toEqual({ mode: "all", databases: ["hr", "analytics"] });
  });

  it("uses the first selected database as bootstrap", () => {
    expect(
      resolveBootstrapDatabase({
        databaseMode: "selected",
        databases: "hr, analytics",
      }),
    ).toBe("hr");
    expect(resolveBootstrapDatabase({})).toBe("postgres");
  });
});
