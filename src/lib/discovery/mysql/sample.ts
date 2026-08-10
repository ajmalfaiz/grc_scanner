import type { MysqlConnection } from "@/lib/discovery/mysql/connect";
import {
  quoteIdent,
  quoteQualified,
} from "@/lib/discovery/mysql/connection-values";
import {
  MAX_ROWS_PER_TABLE,
  type ColumnCatalog,
  type MysqlScopeValues,
  type TableCatalog,
  type TableSampleResult,
} from "@/lib/discovery/mysql/types";

export function resolveSamplingRate(scope: MysqlScopeValues): number {
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
  const maxRows = options && "maxRows" in options ? options.maxRows : MAX_ROWS_PER_TABLE;
  if (estimatedRows <= 0) {
    return maxRows == null ? 50 : Math.min(50, maxRows);
  }
  const target = Math.ceil((estimatedRows * ratePercent) / 100);
  if (maxRows == null) {
    return Math.max(1, target);
  }
  return Math.max(1, Math.min(target, maxRows));
}

function columnSelectList(columns: ColumnCatalog[]): string {
  return columns.map((c) => quoteIdent(c.column)).join(", ");
}

export async function sampleTableRowsWithMetadata(
  conn: MysqlConnection,
  table: TableCatalog,
  columns: ColumnCatalog[],
  scope: MysqlScopeValues,
): Promise<TableSampleResult> {
  const rate = resolveSamplingRate(scope);
  const estimated = table.estimatedRows;
  const uncapped = scope.coverageMode === "full";
  const limit = resolveSampleLimit(estimated || 1000, rate, {
    maxRows: uncapped ? null : MAX_ROWS_PER_TABLE,
  });
  const fullTable = uncapped && rate >= 100;
  const method = scope.sampleMethod === "systematic" ? "systematic" : "random";

  if (columns.length === 0) {
    return {
      rows: [],
      estimatedRows: estimated,
      sampleLimit: limit,
      sampledRecords: 0,
      sampleRate: rate,
      method,
      capped: false,
    };
  }

  const qualified = quoteQualified(table.schema, table.table);
  const columnList = columnSelectList(columns);
  const buildResult = (rows: Record<string, unknown>[]): TableSampleResult => ({
    rows,
    estimatedRows: estimated,
    sampleLimit: fullTable ? rows.length : limit,
    sampledRecords: rows.length,
    sampleRate: rate,
    method,
    capped: !uncapped && limit >= MAX_ROWS_PER_TABLE && estimated > MAX_ROWS_PER_TABLE,
  });

  if (fullTable) {
    const [rows] = await conn.query(`SELECT ${columnList} FROM ${qualified}`);
    return buildResult(rows as Record<string, unknown>[]);
  }

  if (method === "systematic") {
    // MySQL 8+ window functions approximate every-Nth-row sampling.
    const stride = Math.max(1, Math.floor(100 / Math.max(rate, 0.1)));
    if (stride <= 1) {
      const [rows] = await conn.query(
        `SELECT ${columnList} FROM ${qualified} LIMIT ${limit}`,
      );
      return buildResult(rows as Record<string, unknown>[]);
    }
    try {
      const fetchCount = Math.min(limit * stride, MAX_ROWS_PER_TABLE * stride);
      const [rows] = await conn.query(
        `SELECT ${columnList} FROM (
           SELECT ${columnList}, ROW_NUMBER() OVER () AS __rn
           FROM ${qualified}
           LIMIT ${fetchCount}
         ) AS sampled
         WHERE (__rn % ${stride}) = 1
         LIMIT ${limit}`,
      );
      return buildResult(rows as Record<string, unknown>[]);
    } catch {
      // MySQL 5.7 has no window functions — fall through to a plain LIMIT.
      const [rows] = await conn.query(
        `SELECT ${columnList} FROM ${qualified} LIMIT ${limit}`,
      );
      return buildResult(rows as Record<string, unknown>[]);
    }
  }

  // Random sample: RAND() is fine at the row counts this scanner samples.
  const [rows] = await conn.query(
    `SELECT ${columnList} FROM ${qualified} ORDER BY RAND() LIMIT ${limit}`,
  );
  return buildResult(rows as Record<string, unknown>[]);
}
