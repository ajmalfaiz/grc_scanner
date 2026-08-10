import { describe, expect, it, vi } from "vitest";

import {
  quoteIdent,
  validateMysqlConnectionValues,
} from "@/lib/discovery/mysql/connection-values";
import { catalogTables } from "@/lib/discovery/mysql/catalog";
import type { MysqlConnection } from "@/lib/discovery/mysql/connect";
import { resolveScanDatabasesWithConnection } from "@/lib/discovery/mysql/list-databases";

vi.mock("mysql2/promise", () => ({
  default: { createConnection: vi.fn() },
}));

function fakeConnection(rowsBySql: Array<{ match: RegExp; rows: unknown[] }>) {
  return {
    async query(sql: string) {
      const found = rowsBySql.find((entry) => entry.match.test(sql));
      return [found?.rows ?? []];
    },
    async end() {},
    destroy() {},
  } as unknown as MysqlConnection;
}

describe("mysql connection-values", () => {
  it("requires host, username, database", () => {
    expect(() => validateMysqlConnectionValues({})).toThrow(/host is required/);
    expect(() =>
      validateMysqlConnectionValues({ host: "db", username: "u" }),
    ).toThrow(/database is required/);
  });

  it("defaults port and sslMode", () => {
    const values = validateMysqlConnectionValues({
      host: "db.internal",
      username: "reader",
      database: "app",
      password: "secret",
    });
    expect(values.port).toBe("3306");
    expect(values.sslMode).toBe("preferred");
  });

  it("allows a blank database when databaseMode is all", () => {
    const values = validateMysqlConnectionValues({
      host: "db.internal",
      username: "reader",
      databaseMode: "all",
    });
    expect(values.databaseMode).toBe("all");
    expect(values.database).toBe("");
  });

  it("accepts a comma-separated selected database list", () => {
    const values = validateMysqlConnectionValues({
      host: "db.internal",
      username: "reader",
      databaseMode: "selected",
      databases: "app_production, analytics",
    });
    expect(values.databaseMode).toBe("selected");
    expect(values.databases).toBe("app_production, analytics");
    expect(values.database).toBe("app_production");
  });

  it("rejects an invalid port", () => {
    expect(() =>
      validateMysqlConnectionValues({
        host: "db",
        username: "u",
        database: "d",
        port: "not-a-port",
      }),
    ).toThrow(/Invalid port/);
  });
});

describe("mysql identifiers", () => {
  it("backtick-quotes identifiers and escapes embedded backticks", () => {
    expect(quoteIdent("employees")).toBe("`employees`");
    expect(quoteIdent("weird`name")).toBe("`weird``name`");
  });
});

describe("mysql catalog", () => {
  it("catalogues columns for the connected database, skipping system schemas", async () => {
    const conn = fakeConnection([
      {
        match: /information_schema\.COLUMNS/,
        rows: [
          {
            TABLE_SCHEMA: "app_production",
            TABLE_NAME: "customers",
            COLUMN_NAME: "work_email",
            DATA_TYPE: "varchar",
            COLUMN_TYPE: "varchar(255)",
            TABLE_ROWS: 1000,
          },
          {
            TABLE_SCHEMA: "mysql",
            TABLE_NAME: "user",
            COLUMN_NAME: "Host",
            DATA_TYPE: "char",
            COLUMN_TYPE: "char(60)",
            TABLE_ROWS: 5,
          },
        ],
      },
    ]);

    const tables = await catalogTables(
      conn,
      { excludeSystemSchemas: "yes" },
      { includeDatabases: ["app_production"] },
    );

    expect(tables).toHaveLength(1);
    expect(tables[0].table).toBe("customers");
    expect(tables[0].columns[0].column).toBe("work_email");
  });

  it("returns no tables when includeDatabases is empty", async () => {
    const conn = fakeConnection([{ match: /information_schema\.COLUMNS/, rows: [] }]);
    const tables = await catalogTables(conn, { excludeSystemSchemas: "yes" }, { includeDatabases: [] });
    expect(tables).toEqual([]);
  });
});

describe("resolveScanDatabasesWithConnection", () => {
  it("uses SHOW DATABASES (minus system schemas) when mode is all", async () => {
    const conn = fakeConnection([
      {
        match: /SHOW DATABASES/,
        rows: [
          { Database: "information_schema" },
          { Database: "app_production" },
          { Database: "analytics" },
          { Database: "mysql" },
        ],
      },
    ]);

    const databases = await resolveScanDatabasesWithConnection(conn, {
      host: "db",
      port: "3306",
      username: "u",
      password: "p",
      sslMode: "preferred",
      databaseMode: "all",
      databases: "",
      database: "",
    });

    expect(databases).toEqual(["app_production", "analytics"]);
  });

  it("uses the explicit list when mode is selected", async () => {
    const conn = fakeConnection([]);
    const databases = await resolveScanDatabasesWithConnection(conn, {
      host: "db",
      port: "3306",
      username: "u",
      password: "p",
      sslMode: "preferred",
      databaseMode: "selected",
      databases: "app_production, analytics",
      database: "app_production",
    });
    expect(databases).toEqual(["app_production", "analytics"]);
  });

  it("throws when mode is selected but nothing was chosen", async () => {
    const conn = fakeConnection([]);
    await expect(
      resolveScanDatabasesWithConnection(conn, {
        host: "db",
        port: "3306",
        username: "u",
        password: "p",
        sslMode: "preferred",
        databaseMode: "selected",
        databases: "",
        database: "",
      }),
    ).rejects.toThrow(/Select at least one database/);
  });
});
