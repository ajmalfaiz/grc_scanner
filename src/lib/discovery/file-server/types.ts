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

export type FileServerProtocol = "smb" | "sftp";

export type FileServerAuthMethod = "password" | "privateKey";

export type FileServerConnectionValues = {
  protocol: FileServerProtocol;
  host: string;
  username: string;
  /** Password auth, or empty when using a private key. */
  password: string;
  authMethod?: FileServerAuthMethod;
  privateKey?: string;
  /** Passphrase for an encrypted private key. */
  passphrase?: string;
  shareName?: string;
  domain?: string;
  port?: string;
  basePath?: string;
};

export type FileServerScopeValues = {
  coverageMode: "sample" | "full";
  fileTypes: "office_text" | "spreadsheets" | "all";
  maxFileSizeMb: string;
  maxFiles: string;
  prefer: "recent" | "random";
};

export type RemoteDirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
};

export type RemoteStat = {
  path: string;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
};

export type RemoteFsTestResult = {
  message: string;
  details?: Record<string, string>;
};

export type RemoteFs = {
  test: () => Promise<RemoteFsTestResult>;
  listDir: (path: string) => Promise<RemoteDirEntry[]>;
  stat: (path: string) => Promise<RemoteStat>;
  read: (path: string, opts: { maxBytes: number }) => Promise<Buffer>;
  close: () => Promise<void>;
};

export type FileEntry = {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtimeMs: number;
};

export type PathTriageHit = {
  path: string;
  piiType: string;
  confidence: Confidence;
  category?: PiiCategory;
  score: number;
  signals?: DetectionSignal[];
  reasons?: string[];
};

export type FileExtractResult = {
  values: string[];
  sampledRecords: number;
  capped: boolean;
  partial: boolean;
  unsupported: boolean;
  reason?: string;
  fieldHints?: Array<{ name: string; path: string }>;
};

export type FileServerScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-file-server-1";
export const DETECTOR_VERSION = "openredaction-1";

export const MAX_INVENTORY_FILES = 10_000;
export const MAX_WALK_DEPTH = 20;
export const CONNECT_TIMEOUT_MS = 10_000;
export const WALK_TIMEOUT_MS = 60_000;
export const SCAN_TIMEOUT_MS = 120_000;
export const MAX_EXTRACT_CHARS = 200_000;
export const MAX_CSV_ROWS_SAMPLE = 200;
export const MAX_CSV_ROWS_FULL = 2_000;
export const MAX_XLSX_CELLS = 5_000;
export const MAX_PDF_PAGES = 25;
export const MAX_READ_BYTES = 5 * 1024 * 1024;
