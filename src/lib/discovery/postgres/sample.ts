import type { SqlClient } from "@/lib/discovery/postgres/connect";
import {
  quoteIdent,
  quoteQualified,
} from "@/lib/discovery/postgres/identifiers";
import {
  MAX_ROWS_PER_TABLE,
  type ColumnCatalog,
  type PostgresScopeValues,
  type TableSampleResult,
  type TableCatalog,
} from "@/lib/discovery/postgres/types";

export function resolveSamplingRate(scope: PostgresScopeValues): number {
  const raw =
    scope.coverageMode === "full"
      ? (scope.samplingRateFull ?? "100")
      : (scope.samplingRate ?? "1");
  const rate = Number.parseFloat(raw);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return Math.min(rate, 100);
}

export function resolveSampleLimit(
  estimatedRows: number,
  ratePercent: number,
  options?: { maxRows?: number | null },
): number {
  const maxRows =
    options && "maxRows" in options ? options.maxRows : MAX_ROWS_PER_TABLE;

  if (estimatedRows <= 0) {
    return maxRows == null ? 50 : Math.min(50, maxRows);
  }

  const target = Math.ceil((estimatedRows * ratePercent) / 100);
  if (maxRows == null) {
    return Math.max(1, target);
  }
  return Math.max(1, Math.min(target, maxRows));
}

async function estimateRowCount(
  sql: SqlClient,
  table: TableCatalog,
): Promise<number> {
  const schema = table.schema;
  const name = table.table;
  const rows = await sql`
    SELECT COALESCE(c.reltuples, 0)::bigint AS estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schema}
      AND c.relname = ${name}
      AND c.relkind = 'r'
    LIMIT 1
  `;
  const estimate = Number(rows[0]?.estimate ?? 0);
  return Number.isFinite(estimate) && estimate > 0 ? estimate : 0;
}

function columnSelectList(columns: ColumnCatalog[]): string {
  return columns.map((c) => quoteIdent(c.column)).join(", ");
}

export async function sampleTableRows(
  sql: SqlClient,
  table: TableCatalog,
  columns: ColumnCatalog[],
  scope: PostgresScopeValues,
): Promise<Record<string, unknown>[]> {
  const result = await sampleTableRowsWithMetadata(sql, table, columns, scope);
  return result.rows;
}

export async function sampleTableRowsWithMetadata(
  sql: SqlClient,
  table: TableCatalog,
  columns: ColumnCatalog[],
  scope: PostgresScopeValues,
): Promise<TableSampleResult> {
  const rate = resolveSamplingRate(scope);
  const estimated = table.estimatedRows || (await estimateRowCount(sql, table));
  // Deep scan honors the selected rate with no hard per-table row cap.
  const uncapped = scope.coverageMode === "full";
  const limit = resolveSampleLimit(estimated || 1000, rate, {
    maxRows: uncapped ? null : MAX_ROWS_PER_TABLE,
  });
  const fullTable = uncapped && rate >= 100;

  if (columns.length === 0) {
    return {
      rows: [],
      estimatedRows: estimated,
      sampleLimit: limit,
      sampledRecords: 0,
      sampleRate: rate,
      method: scope.sampleMethod === "systematic" ? "systematic" : "random",
      capped: false,
    };
  }

  const qualified = quoteQualified(table.schema, table.table);
  const columnList = columnSelectList(columns);
  const method = scope.sampleMethod === "systematic" ? "systematic" : "random";
  const buildResult = (rows: Record<string, unknown>[]): TableSampleResult => ({
    rows,
    estimatedRows: estimated,
    sampleLimit: fullTable ? rows.length : limit,
    sampledRecords: rows.length,
    sampleRate: rate,
    method,
    capped:
      !uncapped &&
      limit >= MAX_ROWS_PER_TABLE &&
      estimated > MAX_ROWS_PER_TABLE,
  });

  if (method === "systematic") {
    // Approximate every-Nth-row sampling with a stable ORDER BY + stride.
    const stride = Math.max(1, Math.floor(100 / Math.max(rate, 0.1)));
    if (fullTable || stride <= 1) {
      const result = await sql.unsafe(
        `SELECT ${columnList} FROM ${qualified}`,
      );
      return buildResult(result as Record<string, unknown>[]);
    }
    const fetchCount = uncapped
      ? limit * stride
      : Math.min(limit * stride, MAX_ROWS_PER_TABLE * stride);
    const result = await sql.unsafe(
      `SELECT ${columnList} FROM (
         SELECT ${columnList}, row_number() OVER () AS __rn
         FROM ${qualified}
         LIMIT ${fetchCount}
       ) AS sampled
       WHERE (__rn % ${stride}) = 1
       LIMIT ${limit}`,
    );
    return buildResult(result as Record<string, unknown>[]);
  }

  if (rate >= 1 && rate < 100) {
    try {
      // Deep scan: TABLESAMPLE already approximates the rate; do not re-cap.
      const limitClause = uncapped ? "" : ` LIMIT ${limit}`;
      const result = await sql.unsafe(
        `SELECT ${columnList} FROM ${qualified} TABLESAMPLE SYSTEM (${rate})${limitClause}`,
      );
      return buildResult(result as Record<string, unknown>[]);
    } catch {
      // Fall through to ORDER BY random when TABLESAMPLE is unavailable.
    }
  }

  if (rate >= 100) {
    const result = await sql.unsafe(
      fullTable
        ? `SELECT ${columnList} FROM ${qualified}`
        : `SELECT ${columnList} FROM ${qualified} LIMIT ${limit}`,
    );
    return buildResult(result as Record<string, unknown>[]);
  }

  const result = await sql.unsafe(
    `SELECT ${columnList} FROM ${qualified} ORDER BY random() LIMIT ${limit}`,
  );
  return buildResult(result as Record<string, unknown>[]);
}
