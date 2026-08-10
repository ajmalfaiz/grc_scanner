import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";

export type { CoverageIssue, CoverageSummary, Finding, ScanRunMetadata };

export type EmailConnectionValues = {
  host: string;
  port: string;
  username: string;
  password: string;
  tls: string;
  mailboxes: string[];
};

export type EmailScopeValues = {
  coverageMode?: string;
  maxMessagesPerMailbox: string;
  lookbackDays: string;
  includeAttachments: "yes" | "no";
};

export type EmailScanResultPayload = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export const SCANNER_VERSION = "discovery-email-1";
export const DETECTOR_VERSION = "openredaction-1";
export const CONNECT_TIMEOUT_MS = 10_000;
export const MAX_MESSAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Attachment extensions we can meaningfully extract text from. */
export const EXTRACTABLE_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "xlsx",
  "xls",
  "csv",
  "txt",
  "json",
]);
