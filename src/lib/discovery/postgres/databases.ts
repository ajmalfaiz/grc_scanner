import type { PostgresConnectionValues } from "@/lib/discovery/postgres/types";

/** Prefer these when opening a session just to list databases. */
export const POSTGRES_BOOTSTRAP_DATABASES = ["postgres", "template1"] as const;

export type PostgresDatabaseMode = "all" | "selected";

export type PostgresDatabaseSelection = {
  mode: PostgresDatabaseMode;
  /** Explicit names when mode is "selected". */
  databases: string[];
};

export function parseDatabaseList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of value.split(",")) {
    const name = part.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function formatDatabaseList(names: string[]): string {
  return names.join(", ");
}

/**
 * Resolve selection from form / saved connection values.
 * Backward compatible: a lone `database` field becomes selected mode.
 */
export function resolvePostgresDatabaseSelection(
  values: Record<string, string>,
): PostgresDatabaseSelection {
  const modeRaw = values.databaseMode?.trim().toLowerCase();
  const listed = parseDatabaseList(values.databases);
  const single = values.database?.trim();

  if (modeRaw === "all") {
    return { mode: "all", databases: listed };
  }

  if (modeRaw === "selected") {
    return {
      mode: "selected",
      databases: listed.length > 0 ? listed : single ? [single] : [],
    };
  }

  // Legacy / connection-string: one database name.
  if (single) {
    return { mode: "selected", databases: [single] };
  }

  if (listed.length > 0) {
    return { mode: "selected", databases: listed };
  }

  return { mode: "selected", databases: [] };
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
