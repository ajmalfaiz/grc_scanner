import {
  formatDatabaseList,
  parseDatabaseList,
  resolveDatabaseSelection,
  type DatabaseMode,
  type DatabaseSelection,
} from "@/lib/discovery/shared/database-selection";

export { formatDatabaseList, parseDatabaseList };
export type MysqlDatabaseMode = DatabaseMode;
export type MysqlDatabaseSelection = DatabaseSelection;

/** Accepts either raw form values or an already-validated connection object. */
export function resolveMysqlDatabaseSelection(values: {
  databaseMode?: string;
  databases?: string;
  database?: string;
}): MysqlDatabaseSelection {
  return resolveDatabaseSelection(values as Record<string, string>);
}
