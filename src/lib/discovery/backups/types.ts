import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type { CoverageIssue, CoverageSummary, Finding, ScanRunMetadata };

export type BackupsSourceType = "local" | "sftp" | "smb";

export type BackupsConnectionValues = {
  sourceType: BackupsSourceType;
  basePath: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  authMethod?: "password" | "privateKey";
  privateKey?: string;
  passphrase?: string;
  shareName?: string;
  domain?: string;
};

export type BackupsScopeValues = {
  coverageMode: "sample" | "full";
  maxArchiveSizeMb: string;
  maxArchives: string;
  maxEntriesPerArchive: string;
};

export type BackupsScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-backups-1";
export const DETECTOR_VERSION = "openredaction-1";
export const MAX_ARCHIVE_READ_BYTES = 200 * 1024 * 1024;
