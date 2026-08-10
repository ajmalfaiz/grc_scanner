/**
 * Shared "which databases to scan" selection model — used by every
 * multi-database connector (Postgres, MySQL, …) so the connect step's UI
 * and validation logic don't have to be reimplemented per connector.
 */

export type DatabaseMode = "all" | "selected";

export type DatabaseSelection = {
  mode: DatabaseMode;
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
export function resolveDatabaseSelection(
  values: Record<string, string>,
): DatabaseSelection {
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

export function isDatabaseSelectionReady(values: Record<string, string>): boolean {
  if (values.databaseMode === "all") return true;
  if (parseDatabaseList(values.databases).length > 0) return true;
  return Boolean(values.database?.trim());
}
