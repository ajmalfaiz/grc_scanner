import { withPostgresClient } from "@/lib/discovery/postgres/connect";
import {
  POSTGRES_BOOTSTRAP_DATABASES,
  connectionForDatabase,
  resolveBootstrapDatabase,
  resolvePostgresDatabaseSelection,
} from "@/lib/discovery/postgres/databases";
import type { PostgresConnectionValues } from "@/lib/discovery/postgres/types";

/**
 * List non-template databases the role can see.
 * Connects via bootstrap candidates until one succeeds.
 * Server-only — do not import from client components.
 */
export async function listPostgresDatabases(
  auth: Omit<PostgresConnectionValues, "database">,
  preferredBootstrap?: string,
): Promise<string[]> {
  const candidates = [
    preferredBootstrap?.trim(),
    ...POSTGRES_BOOTSTRAP_DATABASES,
  ].filter((name): name is string => Boolean(name));

  const uniqueCandidates = [...new Set(candidates)];
  let lastError: unknown;

  for (const database of uniqueCandidates) {
    try {
      return await withPostgresClient(
        connectionForDatabase(auth, database),
        async (sql) => {
          const rows = await sql`
            SELECT datname
            FROM pg_database
            WHERE datistemplate = false
            ORDER BY datname
          `;
          return rows
            .map((row) => String(row.datname ?? "").trim())
            .filter(Boolean);
        },
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not list databases");
}

/**
 * Databases to scan for this connection.
 * When mode is "all", lists from the server at scan time.
 * Server-only — do not import from client components.
 */
export async function resolveScanDatabases(
  auth: Omit<PostgresConnectionValues, "database">,
  values: Record<string, string>,
): Promise<string[]> {
  const selection = resolvePostgresDatabaseSelection(values);
  if (selection.mode === "all") {
    return listPostgresDatabases(auth, resolveBootstrapDatabase(values));
  }
  if (selection.databases.length === 0) {
    throw new Error("Select at least one database to scan");
  }
  return selection.databases;
}
