import type {
  Confidence,
  CoverageIssue,
  CoverageSummary,
  DetectionMethod,
  DetectionSignal,
  Finding,
  FindingEvidence,
  PiiCategory,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type {
  Confidence,
  CoverageIssue,
  CoverageSummary,
  DetectionMethod,
  DetectionSignal,
  Finding,
  FindingEvidence,
  PiiCategory,
  ScanRunMetadata,
};

export type MysqlConnectionValues = {
  host: string;
  port: string;
  /** Primary/bootstrap database — used to open the connection and as a label. */
  database: string;
  username: string;
  password: string;
  sslMode: string;
  /** "all" scans every database SHOW DATABASES returns; "selected" uses `databases`. */
  databaseMode: "all" | "selected";
  /** Comma-separated explicit database names, only meaningful when databaseMode is "selected". */
  databases: string;
};

export type MysqlScopeValues = {
  coverageMode?: string;
  excludeSystemSchemas?: string;
  nameTriage?: string;
  samplingRate?: string;
  samplingRateFull?: string;
  sampleMethod?: string;
  contentTargets?: string;
};

export type ColumnCatalog = {
  schema: string;
  table: string;
  column: string;
  dataType: string;
  udtName: string;
};

export type TableCatalog = {
  schema: string;
  table: string;
  columns: ColumnCatalog[];
  estimatedRows: number;
};

export type SkippedTable = {
  schema: string;
  table: string;
  reason: string;
  status?: CoverageIssue["status"];
  estimatedRecords?: number;
};

export type NameTriageHit = {
  column: ColumnCatalog;
  piiType: string;
  confidence: Confidence;
  category?: PiiCategory;
  score?: number;
  signals?: DetectionSignal[];
  reasons?: string[];
};

export type ColumnProfile = {
  column: ColumnCatalog;
  sampledRecords: number;
  nullRecords: number;
  nullRate: number;
  uniqueValues: number;
  averageLength: number;
};

export type TableSampleResult = {
  rows: Record<string, unknown>[];
  estimatedRows: number;
  sampleLimit: number;
  sampledRecords: number;
  sampleRate: number;
  method: string;
  capped: boolean;
};

export type MysqlScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-mysql-1";
export const DETECTOR_VERSION = "openredaction-1";
export const MAX_TABLES = 100;
export const MAX_ROWS_PER_TABLE = 200;
export const CONNECT_TIMEOUT_MS = 8_000;

export const SYSTEM_SCHEMAS = new Set([
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
]);
