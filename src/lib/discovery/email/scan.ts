import { simpleParser } from "mailparser";

import { createImapEmailClient, type EmailClient } from "@/lib/discovery/email/connect";
import {
  normalizeEmailScopeValues,
  resolveSinceDate,
  validateEmailConnectionValues,
} from "@/lib/discovery/email/connection-values";
import {
  DETECTOR_VERSION,
  EXTRACTABLE_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  SCANNER_VERSION,
  type EmailConnectionValues,
  type EmailScanResultPayload,
  type EmailScopeValues,
} from "@/lib/discovery/email/types";
import { extractFileContent } from "@/lib/discovery/file-server/extract";
import {
  detectPiiInValuesDetailed,
  type DetectionAggregate,
} from "@/lib/discovery/pii-detectors";
import type { CoverageIssue, CoverageSummary, Finding, PiiCategory } from "@/lib/discovery-mock-data";

export { validateEmailConnectionValues, normalizeEmailScopeValues };

function riskForCategory(category?: PiiCategory): Finding["riskLevel"] {
  switch (category) {
    case "government_id":
    case "direct_identifier":
      return "high";
    case "financial":
    case "contact":
    case "demographic":
      return "medium";
    default:
      return "low";
  }
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

/** mailparser's `to`/`from` fields are an AddressObject or an array of them. */
function addressText(value: { text?: string } | { text?: string }[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.map((v) => v.text ?? "").join(", ");
  return value.text ?? "";
}

async function collectMessageValues(
  source: Buffer,
  includeAttachments: boolean,
): Promise<string[]> {
  const parsed = await simpleParser(source, { skipHtmlToText: true });
  const values: string[] = [
    parsed.subject ?? "",
    addressText(parsed.from),
    addressText(parsed.to),
    typeof parsed.text === "string" ? parsed.text : "",
  ].filter(Boolean);

  if (includeAttachments) {
    for (const attachment of parsed.attachments ?? []) {
      const ext = extensionOf(attachment.filename ?? "");
      if (!EXTRACTABLE_ATTACHMENT_EXTENSIONS.has(ext)) continue;
      if (attachment.size > MAX_ATTACHMENT_BYTES) continue;
      try {
        const extract = await extractFileContent(ext, attachment.content, { full: false });
        values.push(...extract.values);
      } catch {
        // Unreadable attachment — skip rather than fail the whole message.
      }
    }
  }

  return values;
}

function mergeMailboxFindings(
  mailbox: string,
  detected: Map<string, DetectionAggregate>,
  sampledRecords: number,
): Finding[] {
  const findings: Finding[] = [];
  for (const [piiType, detection] of detected) {
    const matchRate = sampledRecords > 0 ? detection.matchedRecords / sampledRecords : 0;
    const checksumBacked = detection.validators.some((v) => /checksum|verhoeff/i.test(v));
    const confidence: Finding["confidence"] =
      checksumBacked || (detection.matchedRecords >= 3 && matchRate >= 0.2) ? "high" : "medium";
    const category = detection.category as PiiCategory;

    findings.push({
      location: mailbox,
      piiType,
      confidence,
      detectedVia: "content_sample",
      category,
      riskLevel: riskForCategory(category),
      detectionSignals: [
        "value_pattern",
        ...(checksumBacked ? (["checksum"] as const) : []),
      ],
      evidence: {
        sampledRecords,
        matchedRecords: detection.matchedRecords,
        matchRate,
        validators: detection.validators,
        reasons: [
          ...detection.reasons,
          `${detection.matchedRecords} of ${sampledRecords} sampled messages/fields matched`,
        ],
        rawValuesStored: false,
      },
      asset: {
        connectorId: "email",
        assetType: "document_collection",
        name: mailbox,
      },
      field: { name: "message content", path: `${mailbox}#content` },
    });
  }
  return findings;
}

export async function runEmailScan(
  connection: EmailConnectionValues,
  scope: EmailScopeValues,
  options?: { client?: EmailClient },
): Promise<EmailScanResultPayload> {
  const startedAt = new Date();
  const client = options?.client ?? createImapEmailClient(connection);
  const since = resolveSinceDate(scope.lookbackDays);
  const limit =
    scope.coverageMode === "full"
      ? Math.max(1, Number(scope.maxMessagesPerMailbox) || 200) * 5
      : Math.max(1, Number(scope.maxMessagesPerMailbox) || 200);

  const findings: Finding[] = [];
  const issues: CoverageIssue[] = [];
  let scanned = 0;
  let sampledRecords = 0;
  let matchedRecords = 0;

  try {
    for (const mailbox of connection.mailboxes) {
      const result = await client.fetchMailboxMessages(mailbox, { since, limit });
      if (result.error) {
        const denied = /not authorized|permission|no access/i.test(result.error);
        const throttled = /too many|throttl|rate.?limit|try again|temporary/i.test(result.error);
        issues.push({
          asset: mailbox,
          status: denied ? "permission_denied" : throttled ? "timeout" : "skipped",
          reason: throttled ? `${result.error} (retries exhausted)` : result.error,
        });
        continue;
      }
      if (result.messages.length === 0) {
        issues.push({ asset: mailbox, status: "scanned", reason: "No messages in scope" });
        scanned += 1;
        continue;
      }

      scanned += 1;
      const allValues: string[] = [];
      for (const message of result.messages) {
        try {
          const values = await collectMessageValues(
            message.source,
            scope.includeAttachments === "yes",
          );
          allValues.push(...values);
        } catch {
          // Unparseable message — skip it, keep scanning the mailbox.
        }
      }

      sampledRecords += result.messages.length;
      if (result.messages.length >= limit) {
        issues.push({
          asset: mailbox,
          status: "capped",
          reason: `Sample capped at ${limit} messages`,
          sampledRecords: result.messages.length,
        });
      }

      const detected = await detectPiiInValuesDetailed(allValues);
      for (const aggregate of detected.values()) matchedRecords += aggregate.matchedRecords;
      findings.push(...mergeMailboxFindings(mailbox, detected, result.messages.length));
    }
  } finally {
    await client.close();
  }

  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return a.location.localeCompare(b.location);
  });

  const coverage: CoverageSummary = {
    assetsDiscovered: connection.mailboxes.length,
    assetsScanned: scanned,
    assetsSkipped: connection.mailboxes.length - scanned,
    assetsPartial: 0,
    assetsCapped: issues.filter((i) => i.status === "capped").length,
    fieldsScanned: findings.length,
    sampledRecords,
    matchedRecords,
    rawValuesStored: false,
  };

  const completedAt = new Date();

  return {
    scanRun: {
      id: globalThis.crypto?.randomUUID?.() ?? `scan-${completedAt.getTime().toString(36)}`,
      connectorId: "email",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      scannerVersion: SCANNER_VERSION,
      detectorVersion: DETECTOR_VERSION,
      mode: scope.coverageMode ?? "sample",
    },
    scopeLabel: "Mailboxes catalogued",
    scopeValue: connection.mailboxes.length,
    findings,
    coverage,
    coverageIssues: issues,
    coverageLine:
      connection.mailboxes.length === 0
        ? "No mailboxes configured."
        : `${scanned} of ${connection.mailboxes.length} mailboxes scanned; ${sampledRecords} messages sampled${
            issues.length > 0 ? ` — ${issues.length} coverage issue(s)` : ""
          }`,
    methodNote: `IMAP fetch (${
      since ? `since ${since.toISOString().slice(0, 10)}` : "all time"
    }) → subject/from/to/body${scope.includeAttachments === "yes" ? " + attachment text" : ""} → OpenRedaction (in-process). Types only; no message content stored.`,
  };
}

export function safeEmailScanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Scan failed";
  const message = error.message;
  if (/auth|login|credentials|invalid.*password/i.test(message)) {
    return "Authentication failed — check username and password (an app password may be required)";
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|connect/i.test(message)) {
    return "Could not connect to the mail server — check host, port, and network access";
  }
  if (/tls|ssl|certificate/i.test(message)) {
    return "TLS connection failed — check the TLS setting and port";
  }
  if (/is required|Invalid/i.test(message)) return message;
  return "Scan failed — could not complete the email discovery run";
}
