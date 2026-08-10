import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type { CoverageIssue, CoverageSummary, Finding, ScanRunMetadata };

export type SaasAuthType =
  | "bearer"
  | "api_key"
  | "basic"
  | "oauth2_client_credentials"
  | "none";

export type SaasConnectionValues = {
  baseUrl: string;
  authType: SaasAuthType;
  bearerToken?: string;
  apiKeyHeader?: string;
  apiKeyValue?: string;
  basicUsername?: string;
  basicPassword?: string;
  /** OAuth2 client-credentials grant — token is fetched fresh per scan run. */
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  oauthScope?: string;
  extraHeaders?: string;
  resources: Array<{ name: string; path: string }>;
};

export type SaasPaginationMode = "none" | "page_param" | "cursor";

export type SaasScopeValues = {
  coverageMode?: string;
  resultsPath?: string;
  pagination: SaasPaginationMode;
  pageParam: string;
  pageStart: string;
  /** Cursor mode: query param the next-page token is sent back as. */
  cursorParam: string;
  /** Cursor mode: dot path to the next-cursor value in the response. Blank = auto-detect. */
  cursorPath?: string;
  maxPages: string;
  maxObjectsPerResource: string;
  nameTriage?: string;
  maxDepth?: string;
};

export type SaasScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-saas-1";
export const DETECTOR_VERSION = "openredaction-1";
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_RESOURCES = 30;
