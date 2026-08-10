import type { MysqlConnection } from "@/lib/discovery/mysql/connect";
import {
  MAX_TABLES,
  SYSTEM_SCHEMAS,
  type ColumnCatalog,
  type MysqlScopeValues,
  type TableCatalog,
} from "@/lib/discovery/mysql/types";

type ColumnRow = {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_TYPE: string;
  TABLE_ROWS: string | number | null;
};

export async function catalogTables(
  conn: MysqlConnection,
  scope: MysqlScopeValues,
  options: { maxTables?: number; includeDatabases: string[] },
): Promise<TableCatalog[]> {
  const includeSchemas = options.includeDatabases;
  const excludeSystem = scope.excludeSystemSchemas !== "no";
  const maxTables = options?.maxTables ?? MAX_TABLES;

  if (includeSchemas.length === 0) {
    return [];
  }

  const [rows] = await conn.query(
    `SELECT
       c.TABLE_SCHEMA, c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.COLUMN_TYPE,
       t.TABLE_ROWS
     FROM information_schema.COLUMNS c
     INNER JOIN information_schema.TABLES t
       ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
     WHERE t.TABLE_TYPE = 'BASE TABLE'
       AND c.TABLE_SCHEMA IN (?)
     ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`,
    [includeSchemas],
  );

  const byTable = new Map<string, TableCatalog>();

  for (const row of rows as ColumnRow[]) {
    const schema = row.TABLE_SCHEMA;
    const table = row.TABLE_NAME;

    if (excludeSystem && SYSTEM_SCHEMAS.has(schema)) continue;

    const key = `${schema}.${table}`;
    let entry = byTable.get(key);
    if (!entry) {
      if (byTable.size >= maxTables) continue;
      const estimatedRows = Number(row.TABLE_ROWS ?? 0);
      entry = {
        schema,
        table,
        estimatedRows: Number.isFinite(estimatedRows) && estimatedRows > 0 ? estimatedRows : 0,
        columns: [],
      };
      byTable.set(key, entry);
    }

    const column: ColumnCatalog = {
      schema,
      table,
      column: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      udtName: row.COLUMN_TYPE,
    };
    entry.columns.push(column);
  }

  return [...byTable.values()];
}
