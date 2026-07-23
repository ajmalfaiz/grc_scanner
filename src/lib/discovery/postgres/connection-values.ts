import {
  formatDatabaseList,
  resolvePostgresDatabaseSelection,
} from "@/lib/discovery/postgres/databases";
import type { PostgresConnectionValues } from "@/lib/discovery/postgres/types";

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const DEFAULT_PORT = "5432";
const DEFAULT_SSL_MODE = "prefer";

function decodeUrlValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSslMode(value: string | null | undefined): string {
  const mode = (value ?? DEFAULT_SSL_MODE).trim().toLowerCase();

  if (mode === "disable" || mode === "false" || mode === "0") {
    return "disable";
  }

  if (mode === "prefer") {
    return "prefer";
  }

  if (
    mode === "require" ||
    mode === "true" ||
    mode === "1" ||
    mode === "verify-ca" ||
    mode === "verify-full"
  ) {
    return "require";
  }

  throw new Error("Invalid SSL mode in connection string");
}

export function parsePostgresConnectionString(
  value: string,
): PostgresConnectionValues {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid Postgres connection string");
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new Error("Invalid Postgres connection string protocol");
  }

  const host = url.hostname.trim();
  const database = decodeUrlValue(url.pathname.replace(/^\/+/, ""));
  const username = decodeUrlValue(url.username);

  if (!host) throw new Error("host is required");
  if (!database) throw new Error("database is required");
  if (!username) throw new Error("username is required");

  return {
    host,
    port: url.port || DEFAULT_PORT,
    database,
    username,
    password: decodeUrlValue(url.password),
    sslMode: normalizeSslMode(url.searchParams.get("sslmode")),
  };
}

export function normalizePostgresConnectionValues(
  values: Record<string, string>,
): Record<string, string> {
  const connectionString = values.connectionString?.trim();
  if (!connectionString) {
    return syncPostgresDatabaseFields({ ...values });
  }

  const parsed = parsePostgresConnectionString(connectionString);
  return syncPostgresDatabaseFields({
    ...values,
    ...parsed,
    connectionMode:
      values.connectionMode === "connectionString"
        ? "connectionString"
        : "fields",
    connectionString,
    // Connection string implies a single DB unless the user already chose more.
    databaseMode: values.databaseMode?.trim() || "selected",
    databases:
      values.databases?.trim() ||
      formatDatabaseList([parsed.database]),
  });
}

/** Keep `database` (primary) aligned with selection for labels and legacy paths. */
export function syncPostgresDatabaseFields(
  values: Record<string, string>,
): Record<string, string> {
  const selection = resolvePostgresDatabaseSelection(values);
  const primary =
    selection.databases[0] ??
    values.database?.trim() ??
    values.bootstrapDatabase?.trim() ??
    "postgres";

  return {
    ...values,
    databaseMode: selection.mode,
    databases:
      selection.mode === "selected"
        ? formatDatabaseList(selection.databases)
        : (values.databases ?? ""),
    database: primary,
  };
}
