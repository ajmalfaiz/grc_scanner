import { fetchResourceRecords, resolveAuthHeaders } from "@/lib/discovery/saas/client";
import {
  normalizeSaasScopeValues,
  validateSaasConnectionValues,
} from "@/lib/discovery/saas/connection-values";
import { flattenDocument, mergeFieldMaps } from "@/lib/discovery/mongodb/flatten";
import { resolveMaxDepth } from "@/lib/discovery/mongodb/connection-values";
import { triageFieldPath } from "@/lib/discovery/shared/name-triage";
import {
  detectPiiInValuesDetailed,
  type DetectionAggregate,
} from "@/lib/discovery/pii-detectors";
import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  SaasConnectionValues,
  SaasScanResultPayload,
  SaasScopeValues,
} from "@/lib/discovery/saas/types";
import { DETECTOR_VERSION, SCANNER_VERSION } from "@/lib/discovery/saas/types";
import type { PiiCategory } from "@/lib/discovery-mock-data";

export { validateSaasConnectionValues, normalizeSaasScopeValues };

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

type FieldFinding = {
  fieldPath: string;
  piiType: string;
  category?: PiiCategory;
  nameConfidence?: Finding["confidence"];
  nameSignals?: Finding["detectionSignals"];
  nameReasons?: string[];
  content?: DetectionAggregate;
  sampledRecords: number;
};

function mergeResourceFindings(resourceName: string, fieldFindings: FieldFinding[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of fieldFindings) {
    const hasName = item.nameConfidence !== undefined;
    const hasContent = item.content !== undefined;
    if (!hasName && !hasContent) continue;

    let detectedVia: Finding["detectedVia"];
    let confidence: Finding["confidence"];
    const validators = item.content?.validators ?? [];
    const checksumBacked = validators.some((v) => /checksum|verhoeff/i.test(v));
    const matchRate =
      item.content && item.sampledRecords > 0 ? item.content.matchedRecords / item.sampledRecords : undefined;

    if (hasName && hasContent) {
      detectedVia = "both";
      confidence =
        checksumBacked || ((matchRate ?? 0) >= 0.2 && (item.content!.matchedRecords ?? 0) >= 2)
          ? "high"
          : "medium";
    } else if (hasName) {
      detectedVia = "name_triage";
      confidence = item.nameConfidence ?? "medium";
    } else {
      detectedVia = "content_sample";
      confidence =
        checksumBacked || (item.content!.matchedRecords >= 3 && (matchRate ?? 0) >= 0.2) ? "high" : "medium";
    }

    const location = `${resourceName}.${item.fieldPath}`;
    findings.push({
      location,
      piiType: item.piiType,
      confidence,
      detectedVia,
      category: item.category,
      riskLevel: riskForCategory(item.category),
      detectionSignals: [
        ...new Set([
          ...(item.nameSignals ?? []),
          ...(hasContent ? (["value_pattern"] as const) : []),
          ...(checksumBacked ? (["checksum"] as const) : []),
        ]),
      ],
      evidence: {
        sampledRecords: item.sampledRecords,
        matchedRecords: item.content?.matchedRecords,
        matchRate,
        validators,
        reasons: [...(item.nameReasons ?? []), ...(item.content?.reasons ?? [])],
        rawValuesStored: false,
      },
      asset: {
        connectorId: "saas",
        assetType: "saas_object",
        name: resourceName,
      },
      field: { name: item.fieldPath, path: location },
    });
  }
  return findings;
}

export async function runSaasScan(
  connection: SaasConnectionValues,
  scope: SaasScopeValues,
): Promise<SaasScanResultPayload> {
  const startedAt = new Date();
  const findings: Finding[] = [];
  const issues: CoverageIssue[] = [];
  const maxDepth = resolveMaxDepth(scope.maxDepth);
  const maxRecords = Math.max(
    1,
    Number(scope.coverageMode === "full" ? Number(scope.maxObjectsPerResource) * 4 : scope.maxObjectsPerResource) ||
      500,
  );

  let scanned = 0;
  let sampledRecords = 0;
  let matchedRecords = 0;

  let headers: Record<string, string>;
  try {
    headers = await resolveAuthHeaders(connection);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resolve authentication";
    return {
      scanRun: {
        id: globalThis.crypto?.randomUUID?.() ?? `scan-${Date.now().toString(36)}`,
        connectorId: "saas",
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        scannerVersion: SCANNER_VERSION,
        detectorVersion: DETECTOR_VERSION,
        mode: scope.coverageMode ?? "sample",
      },
      scopeLabel: "Objects catalogued",
      scopeValue: connection.resources.length,
      findings: [],
      coverage: {
        assetsDiscovered: connection.resources.length,
        assetsScanned: 0,
        assetsSkipped: connection.resources.length,
        assetsPartial: 0,
        assetsCapped: 0,
        fieldsScanned: 0,
        sampledRecords: 0,
        matchedRecords: 0,
        rawValuesStored: false,
      },
      coverageIssues: [{ asset: "authentication", status: "permission_denied", reason: message }],
      coverageLine: `Scan could not start — ${message}`,
      methodNote: "Authentication failed before any resource could be fetched.",
    };
  }

  for (const resource of connection.resources) {
    const result = await fetchResourceRecords(connection, resource.path, scope, maxRecords, headers);
    if (result.error && result.records.length === 0) {
      const isAuth = /401|403|Authentication/i.test(result.error);
      const isRateLimited = /^HTTP 429/.test(result.error);
      issues.push({
        asset: resource.name,
        status: isAuth ? "permission_denied" : isRateLimited ? "timeout" : "skipped",
        reason: isRateLimited ? `${result.error} (retries exhausted)` : result.error,
      });
      continue;
    }
    if (result.error) {
      issues.push({
        asset: resource.name,
        status: "partial",
        reason: result.error,
        sampledRecords: result.records.length,
      });
    }

    scanned += 1;
    sampledRecords += result.records.length;

    const fieldMap = mergeFieldMaps(result.records.map((r) => flattenDocument(r, maxDepth)));
    const fieldFindingsByType = new Map<string, FieldFinding>();

    for (const [fieldPath, values] of fieldMap) {
      const nameHit =
        scope.nameTriage === "heuristics" || scope.nameTriage === "heuristics_llm"
          ? triageFieldPath(fieldPath, `${resource.name} ${fieldPath}`)
          : null;

      const detected = await detectPiiInValuesDetailed(values.flat());
      const types = new Set<string>([...(nameHit ? [nameHit.piiType] : []), ...detected.keys()]);

      for (const piiType of types) {
        const content = detected.get(piiType);
        matchedRecords += content?.matchedRecords ?? 0;
        fieldFindingsByType.set(`${fieldPath}|${piiType}`, {
          fieldPath,
          piiType,
          category: (nameHit?.piiType === piiType ? nameHit.category : content?.category) as
            | PiiCategory
            | undefined,
          nameConfidence: nameHit?.piiType === piiType ? nameHit.confidence : undefined,
          nameSignals: nameHit?.piiType === piiType ? nameHit.signals : undefined,
          nameReasons: nameHit?.piiType === piiType ? nameHit.reasons : undefined,
          content,
          sampledRecords: result.records.length,
        });
      }
    }

    findings.push(...mergeResourceFindings(resource.name, [...fieldFindingsByType.values()]));
  }

  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return a.location.localeCompare(b.location);
  });

  const coverage: CoverageSummary = {
    assetsDiscovered: connection.resources.length,
    assetsScanned: scanned,
    assetsSkipped: connection.resources.length - scanned,
    assetsPartial: issues.filter((i) => i.status === "partial").length,
    assetsCapped: 0,
    fieldsScanned: findings.length,
    sampledRecords,
    matchedRecords,
    rawValuesStored: false,
  };

  const completedAt = new Date();

  return {
    scanRun: {
      id: globalThis.crypto?.randomUUID?.() ?? `scan-${completedAt.getTime().toString(36)}`,
      connectorId: "saas",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      scannerVersion: SCANNER_VERSION,
      detectorVersion: DETECTOR_VERSION,
      mode: scope.coverageMode ?? "sample",
    },
    scopeLabel: "Objects catalogued",
    scopeValue: connection.resources.length,
    findings,
    coverage,
    coverageIssues: issues,
    coverageLine:
      connection.resources.length === 0
        ? "No resources configured."
        : `${scanned} of ${connection.resources.length} resources scanned; ${sampledRecords} objects sampled${
            issues.length > 0 ? ` — ${issues.length} coverage issue(s)` : ""
          }`,
    methodNote: `REST resource fetch (${scope.pagination === "page_param" ? "paginated" : "single page"}) → field-path triage (${
      scope.nameTriage === "heuristics_llm" ? "heuristics + LLM" : "heuristics"
    }) → OpenRedaction (in-process). Types only; no object values stored.`,
  };
}

export function safeSaasScanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Scan failed";
  const message = error.message;
  if (/Authentication failed/i.test(message)) return message;
  if (/timed out|ENOTFOUND|ECONNREFUSED|network/i.test(message)) {
    return "Could not reach the host — check the base URL and network access";
  }
  if (/is required|Invalid/i.test(message)) return message;
  return "Scan failed — could not complete the SaaS discovery run";
}
