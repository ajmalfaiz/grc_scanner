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

export type PostgresConnectionValues = {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  sslMode: string;
};

export type PostgresScopeValues = {
  coverageMode?: string;
  schemas?: string;
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
  sampledRecords?: number;
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

export type PostgresScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-postgres-5";
export const DETECTOR_VERSION = "openredaction-1";
export const MAX_TABLES = 100;
export const MAX_ROWS_PER_TABLE = 200;
export const CONNECT_TIMEOUT_SECONDS = 8;
export const STATEMENT_TIMEOUT_MS = 15_000;

export const SYSTEM_SCHEMAS = new Set([
  "pg_catalog",
  "information_schema",
  "pg_toast",
]);
