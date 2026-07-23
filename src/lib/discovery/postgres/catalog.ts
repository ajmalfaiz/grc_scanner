import { parseSchemaList } from "@/lib/discovery/postgres/identifiers";
import type { SqlClient } from "@/lib/discovery/postgres/connect";
import {
  MAX_TABLES,
  SYSTEM_SCHEMAS,
  type ColumnCatalog,
  type PostgresScopeValues,
  type TableCatalog,
} from "@/lib/discovery/postgres/types";

type ColumnRow = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  estimated_rows: string | number | null;
};

export async function catalogTables(
  sql: SqlClient,
  scope: PostgresScopeValues,
  options?: { maxTables?: number },
): Promise<TableCatalog[]> {
  const includeSchemas = parseSchemaList(scope.schemas);
  const excludeSystem = scope.excludeSystemSchemas !== "no";
  const maxTables = options?.maxTables ?? MAX_TABLES;

  const rows = (await sql`
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      COALESCE(cls.reltuples, 0)::bigint AS estimated_rows
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    LEFT JOIN pg_namespace ns
      ON ns.nspname = c.table_schema
    LEFT JOIN pg_class cls
      ON cls.relnamespace = ns.oid
     AND cls.relname = c.table_name
     AND cls.relkind = 'r'
    WHERE t.table_type = 'BASE TABLE'
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `) as ColumnRow[];

  const byTable = new Map<string, TableCatalog>();

  for (const row of rows) {
    const schema = row.table_schema;
    const table = row.table_name;

    if (excludeSystem && SYSTEM_SCHEMAS.has(schema)) continue;
    if (includeSchemas && !includeSchemas.includes(schema)) continue;

    const key = `${schema}.${table}`;
    let entry = byTable.get(key);
    if (!entry) {
      if (byTable.size >= maxTables) continue;
      const estimatedRows = Number(row.estimated_rows ?? 0);
      entry = {
        schema,
        table,
        estimatedRows:
          Number.isFinite(estimatedRows) && estimatedRows > 0
            ? estimatedRows
            : 0,
        columns: [],
      };
      byTable.set(key, entry);
    }

    const column: ColumnCatalog = {
      schema,
      table,
      column: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
    };
    entry.columns.push(column);
  }

  return [...byTable.values()];
}
