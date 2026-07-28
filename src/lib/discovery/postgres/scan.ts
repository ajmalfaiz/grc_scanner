import { withPostgresClient } from "@/lib/discovery/postgres/connect";
import { catalogTables } from "@/lib/discovery/postgres/catalog";
import { normalizePostgresConnectionValues } from "@/lib/discovery/postgres/connection-values";
import {
  connectionForDatabase,
  resolveBootstrapDatabase,
  resolvePostgresDatabaseSelection,
} from "@/lib/discovery/postgres/databases";
import { resolveScanDatabases } from "@/lib/discovery/postgres/list-databases";
import {
  isFreeTextColumn,
  triageColumnsWithOptionalLlm,
} from "@/lib/discovery/postgres/name-triage";
import {
  detectPiiInValuesDetailed,
  type DetectionAggregate,
} from "@/lib/discovery/pii-detectors";
import { sampleTableRowsWithMetadata } from "@/lib/discovery/postgres/sample";
import type {
  ColumnCatalog,
  ColumnProfile,
  CoverageIssue,
  CoverageSummary,
  Finding,
  NameTriageHit,
  PiiCategory,
  PostgresConnectionValues,
  PostgresScanResultPayload,
  PostgresScopeValues,
  SkippedTable,
  TableSampleResult,
  TableCatalog,
} from "@/lib/discovery/postgres/types";
import {
  DETECTOR_VERSION,
  MAX_TABLES,
  SCANNER_VERSION,
} from "@/lib/discovery/postgres/types";

function locationOf(column: ColumnCatalog, database?: string): string {
  const path = `${column.schema}.${column.table}.${column.column}`;
  return database ? `${database}.${path}` : path;
}

function assetKey(table: TableCatalog, database?: string): string {
  const path = `${table.schema}.${table.table}`;
  return database ? `${database}.${path}` : path;
}

type ContentFindingAggregate = {
  column: ColumnCatalog;
  detection: DetectionAggregate;
  profile: ColumnProfile;
  sample: TableSampleResult;
};

type CoverageAccumulator = {
  issues: CoverageIssue[];
  assetsScanned: Set<string>;
  assetsPartial: Set<string>;
  assetsCapped: Set<string>;
  fieldsScanned: number;
  sampledRecords: number;
  matchedRecords: number;
};

function riskForCategory(category?: PiiCategory): Finding["riskLevel"] {
  switch (category) {
    case "government_id":
    case "direct_identifier":
      return "high";
    case "financial":
    case "contact":
    case "demographic":
      return "medium";
    case "location":
    case "network":
    case "free_text":
    case "internal_identifier":
    default:
      return "low";
  }
}

function profileColumnValues(
  column: ColumnCatalog,
  values: unknown[],
): ColumnProfile {
  let nullRecords = 0;
  let totalLength = 0;
  let populated = 0;
  const unique = new Set<string>();

  for (const value of values) {
    if (value == null || value === "") {
      nullRecords += 1;
      continue;
    }
    const text =
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "bigint"
          ? String(value)
          : typeof value === "object"
            ? JSON.stringify(value)
            : "";
    if (!text) {
      nullRecords += 1;
      continue;
    }
    populated += 1;
    totalLength += text.length;
    unique.add(text);
  }

  const sampledRecords = values.length;
  return {
    column,
    sampledRecords,
    nullRecords,
    nullRate: sampledRecords > 0 ? nullRecords / sampledRecords : 0,
    uniqueValues: unique.size,
    averageLength: populated > 0 ? totalLength / populated : 0,
  };
}

function selectContentColumns(
  table: TableCatalog,
  triageHits: NameTriageHit[],
  contentTargets: string,
): ColumnCatalog[] {
  const ranked = new Set(
    triageHits
      .filter(
        (hit) =>
          hit.column.schema === table.schema &&
          hit.column.table === table.table,
      )
      .map((hit) => hit.column.column),
  );

  if (contentTargets === "all_columns") {
    return table.columns;
  }

  if (contentTargets === "ranked_only") {
    return table.columns.filter((col) => ranked.has(col.column));
  }

  // ranked_plus_freetext (default)
  return table.columns.filter(
    (col) => ranked.has(col.column) || isFreeTextColumn(col),
  );
}

function mergeFindings(
  nameHits: NameTriageHit[],
  contentHits: Map<string, Map<string, ContentFindingAggregate>>,
  database?: string,
): Finding[] {
  type Acc = {
    column: ColumnCatalog;
    location: string;
    piiType: string;
    category?: PiiCategory;
    nameConfidence?: Finding["confidence"];
    nameSignals: Finding["detectionSignals"];
    reasons: string[];
    content?: ContentFindingAggregate;
  };

  const byKey = new Map<string, Acc>();

  for (const hit of nameHits) {
    const location = locationOf(hit.column, database);
    const key = `${location}|${hit.piiType}`;
    byKey.set(key, {
      column: hit.column,
      location,
      piiType: hit.piiType,
      category: hit.category,
      nameConfidence: hit.confidence,
      nameSignals: hit.signals ?? ["metadata_name"],
      reasons: hit.reasons ?? [`Column name matched ${hit.piiType}`],
    });
  }

  for (const [location, typeCounts] of contentHits) {
    for (const [piiType, content] of typeCounts) {
      const key = `${location}|${piiType}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.content = content;
        existing.category = existing.category ?? (content.detection.category as PiiCategory);
      } else {
        byKey.set(key, {
          column: content.column,
          location,
          piiType,
          category: content.detection.category as PiiCategory,
          nameSignals: [],
          reasons: [],
          content,
        });
      }
    }
  }

  const findings: Finding[] = [];
  for (const item of byKey.values()) {
    const hasName = item.nameConfidence !== undefined;
    const hasContent = item.content !== undefined;
    if (!hasName && !hasContent) continue;

    let detectedVia: Finding["detectedVia"];
    let confidence: Finding["confidence"];
    const validators = item.content?.detection.validators ?? [];
    const checksumBacked = validators.some((validator) =>
      /checksum|verhoeff/i.test(validator),
    );
    const matchRate =
      item.content && item.content.profile.sampledRecords > 0
        ? item.content.detection.matchedRecords / item.content.profile.sampledRecords
        : undefined;

    if (hasName && hasContent) {
      detectedVia = "both";
      // Require meaningful content agreement before promoting to high.
      confidence =
        checksumBacked ||
        ((matchRate ?? 0) >= 0.2 && (item.content!.detection.matchedRecords ?? 0) >= 2)
          ? "high"
          : "medium";
    } else if (hasName) {
      detectedVia = "name_triage";
      confidence = item.nameConfidence ?? "medium";
    } else {
      detectedVia = "content_sample";
      confidence =
        checksumBacked ||
        (item.content!.detection.matchedRecords >= 3 && (matchRate ?? 0) >= 0.2)
          ? "high"
          : "medium";
    }

    const detectionSignals = [
      ...(item.nameSignals ?? []),
      ...(hasContent ? (["value_pattern"] as const) : []),
      ...(checksumBacked ? (["checksum"] as const) : []),
      ...((matchRate ?? 0) >= 0.8 ? (["statistical_profile"] as const) : []),
    ];
    const uniqueSignals = [...new Set(detectionSignals)];
    const sampledRecords = item.content?.profile.sampledRecords;
    const matchedRecords = item.content?.detection.matchedRecords;
    const evidence = {
      sampledRecords,
      matchedRecords,
      matchRate,
      nullRecords: item.content?.profile.nullRecords,
      nullRate: item.content?.profile.nullRate,
      uniqueValues: item.content?.profile.uniqueValues,
      validators,
      reasons: [
        ...item.reasons,
        ...(item.content?.detection.reasons ?? []),
        ...(matchRate !== undefined
          ? [`${matchedRecords ?? 0} of ${sampledRecords ?? 0} sampled records matched`]
          : []),
      ],
      rawValuesStored: false as const,
    };

    const tableName = database
      ? `${database}.${item.column.schema}.${item.column.table}`
      : `${item.column.schema}.${item.column.table}`;

    findings.push({
      location: item.location,
      piiType: item.piiType,
      confidence,
      detectedVia,
      category: item.category,
      riskLevel: riskForCategory(item.category),
      detectionSignals: uniqueSignals,
      evidence,
      asset: {
        connectorId: "postgres",
        assetType: "database_table",
        name: tableName,
        schema: item.column.schema,
        estimatedRecords: item.content?.sample.estimatedRows,
      },
      field: {
        name: item.column.column,
        path: item.location,
        dataType: item.column.dataType,
      },
    });
  }

  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.location.localeCompare(b.location);
  });

  return findings;
}

function buildMethodNote(
  scope: PostgresScopeValues,
  llmAssistUsed: boolean,
): string {
  const rate =
    scope.coverageMode === "full"
      ? (scope.samplingRateFull ?? "100")
      : (scope.samplingRate ?? "1");
  const triage =
    scope.nameTriage === "heuristics"
      ? "heuristics only"
      : llmAssistUsed
        ? "heuristics + Gemini metadata assist"
        : "heuristics (Gemini assist unavailable)";
  return `Catalogued columns → name triage (${triage}) → ${rate}% row sample → OpenRedaction (in-process). Types only; no cell values stored.`;
}

function buildCoverageSummary(
  catalogued: number,
  skipped: SkippedTable[],
  coverage: CoverageAccumulator,
): CoverageSummary {
  return {
    assetsDiscovered: catalogued,
    assetsScanned: coverage.assetsScanned.size,
    assetsSkipped: skipped.length,
    assetsPartial: coverage.assetsPartial.size,
    assetsCapped: coverage.assetsCapped.size,
    fieldsScanned: coverage.fieldsScanned,
    sampledRecords: coverage.sampledRecords,
    matchedRecords: coverage.matchedRecords,
    rawValuesStored: false,
  };
}

function buildCoverageLine(summary: CoverageSummary, scope: PostgresScopeValues): string {
  if (summary.assetsDiscovered === 0 && summary.assetsSkipped === 0) {
    return "No tables matched the selected scope.";
  }

  const rate =
    scope.coverageMode === "full"
      ? (scope.samplingRateFull ?? "100")
      : (scope.samplingRate ?? "1");
  const sampleNote = `sampled tables used the selected ${rate}% row target`;
  const details = [
    `${summary.assetsScanned} of ${summary.assetsDiscovered} scoped tables sampled`,
    `${summary.fieldsScanned} columns inspected`,
    `${summary.sampledRecords} rows sampled`,
  ];

  if (
    summary.assetsSkipped === 0 &&
    summary.assetsPartial === 0 &&
    summary.assetsCapped === 0
  ) {
    return `${details.join("; ")} — ${sampleNote}`;
  }
  const gaps = [
    summary.assetsSkipped > 0 ? `${summary.assetsSkipped} skipped` : null,
    summary.assetsPartial > 0 ? `${summary.assetsPartial} partial` : null,
    summary.assetsCapped > 0 ? `${summary.assetsCapped} capped` : null,
  ].filter(Boolean);
  return `${details.join("; ")} — ${gaps.join(", ")}; ${sampleNote}`;
}

async function scanTableContent(
  sql: Parameters<typeof sampleTableRowsWithMetadata>[0],
  table: TableCatalog,
  triageHits: NameTriageHit[],
  scope: PostgresScopeValues,
  contentHits: Map<string, Map<string, ContentFindingAggregate>>,
  skipped: SkippedTable[],
  coverage: CoverageAccumulator,
  database?: string,
) {
  const contentTargets = scope.contentTargets ?? "ranked_plus_freetext";
  const columns = selectContentColumns(table, triageHits, contentTargets);
  const tableKey = assetKey(table, database);
  if (columns.length === 0) {
    coverage.assetsPartial.add(tableKey);
    coverage.issues.push({
      asset: tableKey,
      status: "partial",
      reason: "No columns matched content scan target selection",
      estimatedRecords: table.estimatedRows,
    });
    return;
  }

  try {
    const sample = await sampleTableRowsWithMetadata(sql, table, columns, scope);
    coverage.assetsScanned.add(tableKey);
    coverage.fieldsScanned += columns.length;
    coverage.sampledRecords += sample.sampledRecords;
    if (sample.capped) {
      coverage.assetsCapped.add(tableKey);
      coverage.issues.push({
        asset: tableKey,
        status: "capped",
        reason: `Sample capped at ${sample.sampleLimit} rows`,
        sampledRecords: sample.sampledRecords,
        estimatedRecords: sample.estimatedRows,
      });
    }
    for (const column of columns) {
      const values = sample.rows.map((row) => row[column.column]);
      const profile = profileColumnValues(column, values);
      const detected = await detectPiiInValuesDetailed(values);
      if (detected.size === 0) continue;
      const location = locationOf(column, database);
      const existing =
        contentHits.get(location) ?? new Map<string, ContentFindingAggregate>();
      for (const [piiType, detection] of detected) {
        coverage.matchedRecords += detection.matchedRecords;
        existing.set(piiType, {
          column,
          detection,
          profile,
          sample,
        });
      }
      contentHits.set(location, existing);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "permission or query error";
    const isPermission = /permission|denied|privilege/i.test(message);
    const reason = isPermission ? "permission denied" : "query failed";
    const status = isPermission ? "permission_denied" : "skipped";
    skipped.push({
      schema: table.schema,
      table: table.table,
      reason,
      status,
      estimatedRecords: table.estimatedRows,
    });
    coverage.issues.push({
      asset: tableKey,
      status,
      reason,
      estimatedRecords: table.estimatedRows,
    });
  }
}

async function scanSingleDatabase(
  connection: PostgresConnectionValues,
  scopeValues: PostgresScopeValues,
  options: {
    databaseLabel?: string;
    maxTables: number;
  },
): Promise<{
  tables: TableCatalog[];
  findings: Finding[];
  skipped: SkippedTable[];
  coverage: CoverageAccumulator;
  llmAssistUsed: boolean;
  catalogCapped: boolean;
}> {
  return withPostgresClient(connection, async (sql) => {
    const tables = await catalogTables(sql, scopeValues, {
      maxTables: options.maxTables,
    });
    const allColumns = tables.flatMap((t) => t.columns);
    const { hits: nameHits, llmAssistUsed } =
      await triageColumnsWithOptionalLlm(allColumns, scopeValues.nameTriage);

    const contentHits = new Map<
      string,
      Map<string, ContentFindingAggregate>
    >();
    const skipped: SkippedTable[] = [];
    const coverage: CoverageAccumulator = {
      issues: [],
      assetsScanned: new Set(),
      assetsPartial: new Set(),
      assetsCapped: new Set(),
      fieldsScanned: 0,
      sampledRecords: 0,
      matchedRecords: 0,
    };

    const catalogCapped = tables.length >= options.maxTables;
    if (catalogCapped) {
      coverage.assetsCapped.add(
        options.databaseLabel
          ? `${options.databaseLabel}.catalog`
          : "catalog",
      );
      coverage.issues.push({
        asset: options.databaseLabel
          ? `${options.databaseLabel}.catalog`
          : "catalog",
        status: "capped",
        reason: `Catalog limited to first ${options.maxTables} tables`,
      });
    }

    for (const table of tables) {
      await scanTableContent(
        sql,
        table,
        nameHits,
        scopeValues,
        contentHits,
        skipped,
        coverage,
        options.databaseLabel,
      );
    }

    return {
      tables,
      findings: mergeFindings(nameHits, contentHits, options.databaseLabel),
      skipped,
      coverage,
      llmAssistUsed,
      catalogCapped,
    };
  });
}

function mergeCoverage(
  target: CoverageAccumulator,
  source: CoverageAccumulator,
) {
  for (const issue of source.issues) target.issues.push(issue);
  for (const key of source.assetsScanned) target.assetsScanned.add(key);
  for (const key of source.assetsPartial) target.assetsPartial.add(key);
  for (const key of source.assetsCapped) target.assetsCapped.add(key);
  target.fieldsScanned += source.fieldsScanned;
  target.sampledRecords += source.sampledRecords;
  target.matchedRecords += source.matchedRecords;
}

export async function runPostgresScan(
  connectionValues: PostgresConnectionValues,
  scopeValues: PostgresScopeValues,
  rawConnectionValues?: Record<string, string>,
): Promise<PostgresScanResultPayload> {
  const startedAt = new Date();
  const sourceValues =
    rawConnectionValues ??
    ({
      ...connectionValues,
      databaseMode: "selected",
      databases: connectionValues.database,
    } satisfies Record<string, string>);

  const databases = await resolveScanDatabases(connectionValues, sourceValues);
  const multiDb = databases.length > 1;
  const findings: Finding[] = [];
  const skipped: SkippedTable[] = [];
  const coverage: CoverageAccumulator = {
    issues: [],
    assetsScanned: new Set(),
    assetsPartial: new Set(),
    assetsCapped: new Set(),
    fieldsScanned: 0,
    sampledRecords: 0,
    matchedRecords: 0,
  };
  let tablesCatalogued = 0;
  let llmAssistUsed = false;
  let remainingTableBudget = MAX_TABLES;

  for (const database of databases) {
    if (remainingTableBudget <= 0) {
      coverage.assetsCapped.add("catalog");
      coverage.issues.push({
        asset: "catalog",
        status: "capped",
        reason: `Catalog limited to first ${MAX_TABLES} tables across databases`,
      });
      break;
    }

    try {
      const result = await scanSingleDatabase(
        connectionForDatabase(connectionValues, database),
        scopeValues,
        {
          databaseLabel: multiDb ? database : undefined,
          maxTables: remainingTableBudget,
        },
      );
      tablesCatalogued += result.tables.length;
      remainingTableBudget -= result.tables.length;
      findings.push(...result.findings);
      skipped.push(...result.skipped);
      mergeCoverage(coverage, result.coverage);
      llmAssistUsed = llmAssistUsed || result.llmAssistUsed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "could not scan database";
      const isPermission = /permission|denied|privilege/i.test(message);
      coverage.issues.push({
        asset: database,
        status: isPermission ? "permission_denied" : "skipped",
        reason: isPermission
          ? "permission denied"
          : `Database scan failed: ${safeScanErrorMessage(error).replace(/^Scan failed — /, "")}`,
      });
    }
  }

  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.location.localeCompare(b.location);
  });

  const coverageSummary = buildCoverageSummary(
    tablesCatalogued,
    skipped,
    coverage,
  );
  const completedAt = new Date();
  const dbNote =
    databases.length === 1
      ? databases[0]
      : `${databases.length} databases`;

  return {
    scanRun: {
      id:
        globalThis.crypto?.randomUUID?.() ??
        `scan-${completedAt.getTime().toString(36)}`,
      connectorId: "postgres",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      scannerVersion: SCANNER_VERSION,
      detectorVersion: DETECTOR_VERSION,
      mode: scopeValues.coverageMode ?? "sample",
    },
    scopeLabel: `Tables catalogued (${dbNote})`,
    scopeValue: tablesCatalogued,
    findings,
    coverage: coverageSummary,
    coverageIssues: coverage.issues,
    coverageLine: buildCoverageLine(coverageSummary, scopeValues),
    methodNote: buildMethodNote(scopeValues, llmAssistUsed),
  };
}

export type PostgresAuthValues = Omit<PostgresConnectionValues, "database">;

export function validatePostgresAuthValues(
  values: Record<string, string>,
): PostgresAuthValues {
  const normalized = normalizePostgresConnectionValues(values);
  const required = ["host", "port", "username"] as const;
  for (const key of required) {
    if (!normalized[key]?.trim()) {
      throw new Error(`${key} is required`);
    }
  }

  return {
    host: normalized.host.trim(),
    port: normalized.port.trim(),
    username: normalized.username.trim(),
    password: normalized.password ?? "",
    sslMode: normalized.sslMode?.trim() || "prefer",
  };
}

export function validatePostgresConnectionValues(
  values: Record<string, string>,
): PostgresConnectionValues {
  const auth = validatePostgresAuthValues(values);
  const normalized = normalizePostgresConnectionValues(values);
  const selection = resolvePostgresDatabaseSelection(normalized);

  if (selection.mode === "selected" && selection.databases.length === 0) {
    throw new Error("database is required");
  }

  const database =
    selection.mode === "all"
      ? resolveBootstrapDatabase(normalized)
      : selection.databases[0];

  return {
    ...auth,
    database,
  };
}

export function normalizePostgresScopeValues(
  values: Record<string, string>,
): PostgresScopeValues {
  return {
    coverageMode: values.coverageMode ?? "sample",
    schemas: values.schemas,
    excludeSystemSchemas: values.excludeSystemSchemas ?? "yes",
    nameTriage: values.nameTriage ?? "heuristics",
    samplingRate: values.samplingRate ?? "1",
    samplingRateFull: values.samplingRateFull ?? "100",
    sampleMethod: values.sampleMethod ?? "random",
    contentTargets: values.contentTargets ?? "ranked_plus_freetext",
  };
}

export function safeScanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Scan failed";
  }
  const message = error.message;
  if (/password authentication failed|SASL|28P01/i.test(message)) {
    return "Authentication failed — check username and password";
  }
  if (/does not exist|3D000/i.test(message)) {
    return "Database not found — check the database name";
  }
  if (/ECONNREFUSED|ENOTFOUND|timeout|connect/i.test(message)) {
    return "Could not connect to the host — check host, port, and network access";
  }
  if (/SSL|certificate/i.test(message)) {
    return "SSL connection failed — try a different SSL mode";
  }
  if (
    /Invalid (identifier|schema|Postgres connection string|SSL mode)/i.test(
      message,
    )
  ) {
    return message;
  }
  if (/is required|Select at least/i.test(message)) {
    return message;
  }
  return "Scan failed — could not complete the Postgres discovery run";
}
