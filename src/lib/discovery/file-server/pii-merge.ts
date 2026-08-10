import type { DetectionAggregate } from "@/lib/discovery/pii-detectors";
import type { ConnectorId, DiscoveryAsset } from "@/lib/discovery-mock-data";
import type {
  CoverageIssue,
  CoverageSummary,
  Finding,
  PathTriageHit,
  PiiCategory,
} from "@/lib/discovery/file-server/types";
import type { SampledFile } from "@/lib/discovery/file-server/sample";

export type ContentFindingAggregate = {
  path: string;
  name: string;
  detection: DetectionAggregate;
  sampledRecords: number;
  fieldHints?: Array<{ name: string; path: string }>;
};

function riskForCategory(category?: PiiCategory): Finding["riskLevel"] {
  switch (category) {
    case "government_id":
    case "direct_identifier":
      return "high";
    case "financial":
    case "contact":
    case "demographic":
      return "medium";
    case "location":
    case "network":
    case "free_text":
    case "internal_identifier":
    default:
      return "low";
  }
}

export function mergeFileFindings(
  nameHits: PathTriageHit[],
  contentHits: Map<string, Map<string, ContentFindingAggregate>>,
  connectorId: ConnectorId = "file-server",
  assetType: DiscoveryAsset["assetType"] = "file",
): Finding[] {
  type Acc = {
    path: string;
    name: string;
    piiType: string;
    category?: PiiCategory;
    nameConfidence?: Finding["confidence"];
    nameSignals: Finding["detectionSignals"];
    reasons: string[];
    content?: ContentFindingAggregate;
  };

  const byKey = new Map<string, Acc>();

  for (const hit of nameHits) {
    const key = `${hit.path}|${hit.piiType}`;
    byKey.set(key, {
      path: hit.path,
      name: hit.path.split("/").filter(Boolean).at(-1) ?? hit.path,
      piiType: hit.piiType,
      category: hit.category,
      nameConfidence: hit.confidence,
      nameSignals: hit.signals ?? ["metadata_name"],
      reasons: hit.reasons ?? [`Path matched ${hit.piiType}`],
    });
  }

  for (const [path, typeCounts] of contentHits) {
    for (const [piiType, content] of typeCounts) {
      const key = `${path}|${piiType}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.content = content;
        existing.category =
          existing.category ?? (content.detection.category as PiiCategory);
      } else {
        byKey.set(key, {
          path,
          name: content.name,
          piiType,
          category: content.detection.category as PiiCategory,
          nameSignals: [],
          reasons: [],
          content,
        });
      }
    }
  }

  const findings: Finding[] = [];
  for (const item of byKey.values()) {
    const hasName = item.nameConfidence !== undefined;
    const hasContent = item.content !== undefined;
    if (!hasName && !hasContent) continue;

    let detectedVia: Finding["detectedVia"];
    let confidence: Finding["confidence"];
    const validators = item.content?.detection.validators ?? [];
    const checksumBacked = validators.some((validator) =>
      /checksum|verhoeff/i.test(validator),
    );
    const matchRate =
      item.content && item.content.sampledRecords > 0
        ? item.content.detection.matchedRecords / item.content.sampledRecords
        : undefined;

    if (hasName && hasContent) {
      detectedVia = "both";
      confidence =
        checksumBacked ||
        ((matchRate ?? 0) >= 0.2 &&
          (item.content!.detection.matchedRecords ?? 0) >= 2)
          ? "high"
          : "medium";
    } else if (hasName) {
      detectedVia = "name_triage";
      confidence = item.nameConfidence ?? "medium";
    } else {
      detectedVia = "content_sample";
      confidence =
        checksumBacked ||
        (item.content!.detection.matchedRecords >= 3 && (matchRate ?? 0) >= 0.2)
          ? "high"
          : "medium";
    }

    const detectionSignals = [
      ...(item.nameSignals ?? []),
      ...(hasContent ? (["value_pattern"] as const) : []),
      ...(checksumBacked ? (["checksum"] as const) : []),
      ...((matchRate ?? 0) >= 0.8 ? (["statistical_profile"] as const) : []),
    ];

    const sampledRecords = item.content?.sampledRecords;
    const matchedRecords = item.content?.detection.matchedRecords;
    const primaryField = item.content?.fieldHints?.[0];

    findings.push({
      location: item.path,
      piiType: item.piiType,
      confidence,
      detectedVia,
      category: item.category,
      riskLevel: riskForCategory(item.category),
      detectionSignals: [...new Set(detectionSignals)],
      evidence: {
        sampledRecords,
        matchedRecords,
        matchRate,
        validators,
        reasons: [
          ...item.reasons,
          ...(item.content?.detection.reasons ?? []),
          ...(matchRate !== undefined
            ? [
                `${matchedRecords ?? 0} of ${sampledRecords ?? 0} sampled records matched`,
              ]
            : []),
        ],
        rawValuesStored: false,
      },
      asset: {
        connectorId,
        assetType,
        name: item.name,
        path: item.path,
      },
      field: primaryField
        ? {
            name: primaryField.name,
            path: `${item.path}#${primaryField.path}`,
          }
        : {
            name: item.name,
            path: item.path,
          },
    });
  }

  findings.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.location.localeCompare(b.location);
  });

  return findings;
}

export function buildCoverageSummary(input: {
  discovered: number;
  scanned: number;
  skipped: number;
  partial: number;
  capped: number;
  sampledRecords: number;
  matchedRecords: number;
}): CoverageSummary {
  return {
    assetsDiscovered: input.discovered,
    assetsScanned: input.scanned,
    assetsSkipped: input.skipped,
    assetsPartial: input.partial,
    assetsCapped: input.capped,
    fieldsScanned: input.scanned,
    sampledRecords: input.sampledRecords,
    matchedRecords: input.matchedRecords,
    rawValuesStored: false,
  };
}

export function buildCoverageLine(
  coverage: CoverageSummary,
  issues: CoverageIssue[],
): string {
  const unscanned =
    coverage.assetsDiscovered -
    coverage.assetsScanned -
    coverage.assetsPartial;
  if (unscanned <= 0 && coverage.assetsPartial === 0) {
    return `All ${coverage.assetsDiscovered} inventoried files assessed.`;
  }

  const reasons = new Set<string>();
  for (const issue of issues) {
    if (issue.status === "unsupported") reasons.add("unsupported");
    if (issue.status === "permission_denied") reasons.add("permission denied");
    if (issue.status === "capped") reasons.add("capped");
    if (issue.status === "timeout") reasons.add("timeout");
    if (issue.status === "skipped") reasons.add("skipped");
    if (issue.status === "partial") reasons.add("partial");
    if (/encrypt/i.test(issue.reason)) reasons.add("encrypted");
  }

  const reasonText =
    reasons.size > 0 ? [...reasons].slice(0, 3).join(" / ") : "not fully scanned";
  const gap = Math.max(unscanned, coverage.assetsPartial);
  return `${gap} of ${coverage.assetsDiscovered} files not fully scanned — ${reasonText}`;
}

export function contentHitsFromSamples(
  samples: SampledFile[],
  detections: Map<string, Map<string, DetectionAggregate>>,
): Map<string, Map<string, ContentFindingAggregate>> {
  const contentHits = new Map<string, Map<string, ContentFindingAggregate>>();

  for (const sample of samples) {
    const detected = detections.get(sample.file.path);
    if (!detected || detected.size === 0) continue;
    const byType = new Map<string, ContentFindingAggregate>();
    for (const [piiType, detection] of detected) {
      byType.set(piiType, {
        path: sample.file.path,
        name: sample.file.name,
        detection,
        sampledRecords: sample.extract.sampledRecords,
        fieldHints: sample.extract.fieldHints,
      });
    }
    contentHits.set(sample.file.path, byType);
  }

  return contentHits;
}
