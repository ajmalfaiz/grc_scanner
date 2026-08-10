import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type { CoverageIssue, CoverageSummary, Finding, ScanRunMetadata };

export type ServerAuthMethod = "password" | "privateKey";

export type ServerConnectionValues = {
  host: string;
  port: string;
  username: string;
  authMethod: ServerAuthMethod;
  password: string;
  privateKey?: string;
  passphrase?: string;
  paths: string[];
};

export type ServerScopeValues = {
  coverageMode: "sample" | "full";
  extensions?: string;
  recursive: "yes" | "no";
  lineSample: "head" | "tail" | "head_tail" | "random";
};

export type ServerScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-server-1";
export const DETECTOR_VERSION = "openredaction-1";
export const MAX_FILE_SIZE_MB = "25";
export const MAX_FILES_SAMPLE = 200;
export const LINE_WINDOW = 250;
export const MAX_LINES_READ = 20_000;
