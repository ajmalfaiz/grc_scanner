import { formatDatabaseList, resolveMysqlDatabaseSelection } from "@/lib/discovery/mysql/databases";
import type {
  MysqlConnectionValues,
  MysqlScopeValues,
} from "@/lib/discovery/mysql/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function validateMysqlConnectionValues(
  values: Record<string, string>,
): MysqlConnectionValues {
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const port = (values.port ?? "3306").trim() || "3306";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }
  const sslModeRaw = (values.sslMode ?? "preferred").trim();
  const sslMode = ["disabled", "preferred", "required"].includes(sslModeRaw)
    ? sslModeRaw
    : "preferred";

  const selection = resolveMysqlDatabaseSelection(values);
  if (selection.mode === "selected" && selection.databases.length === 0) {
    throw new Error("database is required");
  }

  return {
    host,
    port,
    username,
    password: values.password ?? "",
    sslMode,
    databaseMode: selection.mode,
    databases:
      selection.mode === "selected" ? formatDatabaseList(selection.databases) : (values.databases ?? ""),
    database: selection.databases[0] ?? "",
  };
}

export type MysqlAuthValues = Pick<
  MysqlConnectionValues,
  "host" | "port" | "username" | "password" | "sslMode"
>;

/** Auth-only validation for listing databases before a database is selected. */
export function validateMysqlAuthValues(
  values: Record<string, string>,
): MysqlAuthValues {
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const port = (values.port ?? "3306").trim() || "3306";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }
  const sslModeRaw = (values.sslMode ?? "preferred").trim();
  const sslMode = ["disabled", "preferred", "required"].includes(sslModeRaw)
    ? sslModeRaw
    : "preferred";

  return { host, port, username, password: values.password ?? "", sslMode };
}

export function normalizeMysqlScopeValues(
  values: Record<string, string>,
): MysqlScopeValues {
  return {
    coverageMode: values.coverageMode ?? "sample",
    excludeSystemSchemas: values.excludeSystemSchemas ?? "yes",
    nameTriage: values.nameTriage ?? "heuristics_llm",
    samplingRate: values.samplingRate ?? "1",
    samplingRateFull: values.samplingRateFull ?? "100",
    sampleMethod: values.sampleMethod ?? "random",
    contentTargets: values.contentTargets ?? "ranked_plus_freetext",
  };
}

/** Backtick-quote a MySQL identifier, escaping embedded backticks. */
export function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

export function quoteQualified(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}
