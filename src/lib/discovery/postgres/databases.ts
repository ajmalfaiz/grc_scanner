import {
  formatDatabaseList,
  parseDatabaseList,
  resolveDatabaseSelection,
  type DatabaseMode,
  type DatabaseSelection,
} from "@/lib/discovery/shared/database-selection";
import type { PostgresConnectionValues } from "@/lib/discovery/postgres/types";

export { formatDatabaseList, parseDatabaseList };
export type PostgresDatabaseMode = DatabaseMode;
export type PostgresDatabaseSelection = DatabaseSelection;

/** Prefer these when opening a session just to list databases. */
export const POSTGRES_BOOTSTRAP_DATABASES = ["postgres", "template1"] as const;

export function resolvePostgresDatabaseSelection(
  values: Record<string, string>,
): PostgresDatabaseSelection {
  return resolveDatabaseSelection(values);
}

/** Database used for auth checks and listing when none is selected yet. */
export function resolveBootstrapDatabase(
  values: Record<string, string>,
): string {
  const selection = resolvePostgresDatabaseSelection(values);
  if (selection.databases[0]) return selection.databases[0];
  const bootstrap = values.bootstrapDatabase?.trim();
  if (bootstrap) return bootstrap;
  return POSTGRES_BOOTSTRAP_DATABASES[0];
}

export function connectionForDatabase(
  base: Omit<PostgresConnectionValues, "database">,
  database: string,
): PostgresConnectionValues {
  return { ...base, database };
}
