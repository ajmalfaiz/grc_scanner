import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type { CoverageIssue, CoverageSummary, Finding, ScanRunMetadata };

export type MongoConnectionValues = {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  authSource: string;
  tls: string;
};

export type MongoScopeValues = {
  coverageMode?: string;
  collectionPattern?: string;
  nameTriage?: string;
  samplingRate?: string;
  samplingRateFull?: string;
  maxDepth?: string;
};

export type CollectionCatalog = {
  name: string;
  estimatedDocs: number;
};

export type MongoScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-mongodb-1";
export const DETECTOR_VERSION = "openredaction-1";
export const MAX_COLLECTIONS = 100;
export const MAX_DOCS_PER_COLLECTION = 200;
export const MAX_DOCS_PER_COLLECTION_FULL = 2_000;
export const CONNECT_TIMEOUT_MS = 8_000;
