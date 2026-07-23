import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Briefcase,
  Cloud,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Laptop,
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
  | "saas";

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
    description: "Log and config files",
    icon: Server,
    enabled: true,
    scanId: "server",
  },
  {
    id: "saas",
    name: "Zoho / HubSpot",
    description: "Third-party SaaS",
    icon: Cloud,
    enabled: true,
    scanId: "saas",
  },
  {
    id: "business-apps",
    name: "Business apps",
    description: "Coming later",
    icon: Briefcase,
    enabled: false,
  },
  {
    id: "endpoints",
    name: "Endpoints",
    description: "Personal laptops",
    icon: Laptop,
    enabled: false,
  },
  {
    id: "email-chat",
    name: "Email / chat",
    description: "Coming later",
    icon: Mail,
    enabled: false,
  },
  {
    id: "backups",
    name: "Backups and archives",
    description: "Coming later",
    icon: Archive,
    enabled: false,
  },
  {
    id: "paper",
    name: "Paper records",
    description: "Coming later",
    icon: FileText,
    enabled: false,
  },
];

export const detectionMethodLabels: Record<DetectionMethod, string> = {
  name_triage: "Name triage",
  content_sample: "Content sample",
  both: "Name + content",
};

export const scanResults: Record<ConnectorId, ConnectorScanResult> = {
  postgres: {
    id: "postgres",
    name: "Postgres",
    icon: Database,
    scopeLabel: "Tables catalogued",
    scopeValue: 0,
    coverageLine: "No scan results yet — run a live Postgres scan.",
    methodNote:
      "Postgres findings are produced only by the live scanner. Types and locations only; no cell values stored.",
    findings: [],
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    icon: Database,
    scopeLabel: "Tables catalogued",
    scopeValue: 9,
    coverageLine: "1 of 10 tables not sampled — access revoked",
    methodNote:
      "Catalogued columns → name triage → sampled rows → local detectors. Types only.",
    findings: [
      {
        location: "users.profile.govt_id",
        piiType: "Aadhaar",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "users.profile.tax_id",
        piiType: "PAN",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "billing.invoices.customer_email",
        piiType: "Email",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "billing.invoices.phone",
        piiType: "Phone number",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "legacy.customer_dump.address_line",
        piiType: "Physical address",
        confidence: "medium",
        detectedVia: "content_sample",
      },
    ],
  },
  mongodb: {
    id: "mongodb",
    name: "MongoDB",
    icon: HardDrive,
    scopeLabel: "Collections catalogued",
    scopeValue: 7,
    coverageLine: "0 of 7 collections not sampled — full coverage",
    methodNote:
      "Field-path catalog → name triage → document sample → local detectors.",
    findings: [
      {
        location: "customers.documents.aadhaar",
        piiType: "Aadhaar",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "customers.documents.pan",
        piiType: "PAN",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "sessions.events.email",
        piiType: "Email",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "kyc.uploads.phone",
        piiType: "Phone number",
        confidence: "medium",
        detectedVia: "name_triage",
      },
      {
        location: "support.threads.body",
        piiType: "Email",
        confidence: "medium",
        detectedVia: "content_sample",
      },
    ],
  },
  "file-server": {
    id: "file-server",
    name: "File server",
    icon: FolderOpen,
    scopeLabel: "Files inventoried",
    scopeValue: 37,
    coverageLine: "3 of 40 files not scanned — encrypted",
    methodNote:
      "Share inventory → type/size triage → text extract sample → local detectors.",
    findings: [
      {
        location: "/shares/hr/onboarding/employee-master.xlsx",
        piiType: "Aadhaar",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/shares/hr/onboarding/employee-master.xlsx",
        piiType: "PAN",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/shares/finance/vendor-list-2025.csv",
        piiType: "Bank account number",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/shares/ops/customer-export.csv",
        piiType: "Email",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/shares/ops/customer-export.csv",
        piiType: "Phone number",
        confidence: "medium",
        detectedVia: "content_sample",
      },
      {
        location: "/shares/legal/contractor-ids.pdf",
        piiType: "Aadhaar",
        confidence: "medium",
        detectedVia: "content_sample",
      },
    ],
  },
  server: {
    id: "server",
    name: "Server",
    icon: Server,
    scopeLabel: "Files inventoried",
    scopeValue: 18,
    coverageLine: "4 of 22 files not scanned — permission denied",
    methodNote:
      "Path inventory → extension filter → line-window sample → local detectors.",
    findings: [
      {
        location: "/var/log/app/auth.log",
        piiType: "Email",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/var/log/app/auth.log",
        piiType: "Phone number",
        confidence: "medium",
        detectedVia: "content_sample",
      },
      {
        location: "/etc/app/config.env",
        piiType: "Email",
        confidence: "high",
        detectedVia: "content_sample",
      },
      {
        location: "/opt/batch/exports/daily-users.json",
        piiType: "PAN",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "/opt/batch/exports/daily-users.json",
        piiType: "Aadhaar",
        confidence: "medium",
        detectedVia: "content_sample",
      },
    ],
  },
  saas: {
    id: "saas",
    name: "Zoho / HubSpot",
    icon: Cloud,
    scopeLabel: "Objects catalogued",
    scopeValue: 24,
    coverageLine: "2 of 26 objects not scanned — API scope limited",
    methodNote:
      "API schema catalog → property triage → object sample → local detectors.",
    findings: [
      {
        location: "Contact.Email",
        piiType: "Email",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "Contact.Phone",
        piiType: "Phone number",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "Deal.Custom_Aadhaar",
        piiType: "Aadhaar",
        confidence: "medium",
        detectedVia: "name_triage",
      },
      {
        location: "Company.BillingEmail",
        piiType: "Email",
        confidence: "high",
        detectedVia: "both",
      },
      {
        location: "Ticket.RequesterPhone",
        piiType: "Phone number",
        confidence: "medium",
        detectedVia: "name_triage",
      },
      {
        location: "Contact.PAN_Field",
        piiType: "PAN",
        confidence: "high",
        detectedVia: "both",
      },
    ],
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
