import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Cloud,
  Database,
  FolderOpen,
  HardDrive,
  Mail,
  Server,
} from "lucide-react";

export type Confidence = "high" | "medium";

/** How the finding was produced — never includes raw cell values. */
export type DetectionMethod =
  | "name_triage"
  | "content_sample"
  | "both";

export type DetectionSignal =
  | "metadata_name"
  | "metadata_context"
  | "value_pattern"
  | "checksum"
  | "statistical_profile";

export type PiiCategory =
  | "direct_identifier"
  | "government_id"
  | "financial"
  | "contact"
  | "location"
  | "network"
  | "demographic"
  | "free_text"
  | "internal_identifier";

export type RiskLevel = "high" | "medium" | "low";

export type DiscoveryAsset = {
  connectorId: ConnectorId;
  assetType:
    | "database_table"
    | "document_collection"
    | "file"
    | "server_path"
    | "saas_object";
  name: string;
  schema?: string;
  database?: string;
  path?: string;
  estimatedRecords?: number;
};

export type DiscoveryField = {
  name: string;
  path: string;
  dataType?: string;
};

export type FindingEvidence = {
  sampledRecords?: number;
  matchedRecords?: number;
  matchRate?: number;
  nullRecords?: number;
  nullRate?: number;
  uniqueValues?: number;
  validators: string[];
  reasons: string[];
  rawValuesStored: false;
};

export type CoverageStatus =
  | "scanned"
  | "partial"
  | "skipped"
  | "permission_denied"
  | "timeout"
  | "unsupported"
  | "capped";

export type CoverageIssue = {
  asset: string;
  status: CoverageStatus;
  reason: string;
  sampledRecords?: number;
  estimatedRecords?: number;
};

export type CoverageSummary = {
  assetsDiscovered: number;
  assetsScanned: number;
  assetsSkipped: number;
  assetsPartial: number;
  assetsCapped: number;
  fieldsScanned: number;
  sampledRecords: number;
  matchedRecords: number;
  rawValuesStored: false;
};

export type ScanRunMetadata = {
  id: string;
  connectorId: ConnectorId;
  startedAt: string;
  completedAt: string;
  scannerVersion: string;
  detectorVersion: string;
  mode: string;
};

export type ConnectorId =
  | "postgres"
  | "mysql"
  | "mongodb"
  | "file-server"
  | "server"
  | "saas"
  | "email"
  | "backups";

export type Finding = {
  location: string;
  piiType: string;
  confidence: Confidence;
  detectedVia: DetectionMethod;
  category?: PiiCategory;
  riskLevel?: RiskLevel;
  detectionSignals?: DetectionSignal[];
  evidence?: FindingEvidence;
  asset?: DiscoveryAsset;
  field?: DiscoveryField;
};

export type ConnectorScanResult = {
  id: ConnectorId;
  name: string;
  icon: LucideIcon;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  /** Always present — even when zero uncovered. */
  coverageLine: string;
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  scanRun?: ScanRunMetadata;
  /** Short note on how this scan result was produced. */
  methodNote: string;
};

export type ConnectorCard = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  /** Only for enabled connectors — matches scan result id */
  scanId?: ConnectorId;
};

export const connectorCards: ConnectorCard[] = [
  {
    id: "postgres",
    name: "Postgres",
    description: "Relational database",
    icon: Database,
    enabled: true,
    scanId: "postgres",
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Relational database",
    icon: Database,
    enabled: true,
    scanId: "mysql",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Document database",
    icon: HardDrive,
    enabled: true,
    scanId: "mongodb",
  },
  {
    id: "file-server",
    name: "File server",
    description: "SMB / SFTP shares",
    icon: FolderOpen,
    enabled: true,
    scanId: "file-server",
  },
  {
    id: "server",
    name: "Server",
    description: "Log and config files (SSH)",
    icon: Server,
    enabled: true,
    scanId: "server",
  },
  {
    id: "saas",
    name: "SaaS / business app",
    description: "Any REST API app — add more over time",
    icon: Cloud,
    enabled: true,
    scanId: "saas",
  },
  {
    id: "email",
    name: "Email",
    description: "IMAP mailboxes",
    icon: Mail,
    enabled: true,
    scanId: "email",
  },
  {
    id: "backups",
    name: "Backups and archives",
    description: "Zip/tar archives on local/SFTP/SMB",
    icon: Archive,
    enabled: true,
    scanId: "backups",
  },
];

export const detectionMethodLabels: Record<DetectionMethod, string> = {
  name_triage: "Name triage",
  content_sample: "Content sample",
  both: "Name + content",
};

const NO_SCAN_YET = "No scan results yet — run a live scan.";

export const scanResults: Record<ConnectorId, ConnectorScanResult> = {
  postgres: {
    id: "postgres",
    name: "Postgres",
    icon: Database,
    scopeLabel: "Tables catalogued",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no cell values stored.",
    findings: [],
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    icon: Database,
    scopeLabel: "Tables catalogued",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no cell values stored.",
    findings: [],
  },
  mongodb: {
    id: "mongodb",
    name: "MongoDB",
    icon: HardDrive,
    scopeLabel: "Collections catalogued",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no document values stored.",
    findings: [],
  },
  "file-server": {
    id: "file-server",
    name: "File server",
    icon: FolderOpen,
    scopeLabel: "Files inventoried",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no file contents stored.",
    findings: [],
  },
  server: {
    id: "server",
    name: "Server",
    icon: Server,
    scopeLabel: "Files inventoried",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no file contents stored.",
    findings: [],
  },
  saas: {
    id: "saas",
    name: "SaaS / business app",
    icon: Cloud,
    scopeLabel: "Objects catalogued",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no object values stored.",
    findings: [],
  },
  email: {
    id: "email",
    name: "Email",
    icon: Mail,
    scopeLabel: "Mailboxes catalogued",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no message contents stored.",
    findings: [],
  },
  backups: {
    id: "backups",
    name: "Backups and archives",
    icon: Archive,
    scopeLabel: "Archives inventoried",
    scopeValue: 0,
    coverageLine: NO_SCAN_YET,
    methodNote:
      "Findings are produced only by the live scanner. Types and locations only; no archive contents stored.",
    findings: [],
  },
};

export function getScanResult(id: string): ConnectorScanResult | undefined {
  if (id in scanResults) {
    return scanResults[id as ConnectorId];
  }
  return undefined;
}

export function getConnectorCard(scanId: ConnectorId): ConnectorCard | undefined {
  return connectorCards.find((c) => c.scanId === scanId);
}

export function countNeedsReview(findings: Finding[]): number {
  return findings.filter((f) => f.confidence === "medium").length;
}
