import type { MongoClient } from "mongodb";

import { catalogCollections } from "@/lib/discovery/mongodb/catalog";
import { withMongoClient } from "@/lib/discovery/mongodb/connect";
import {
  normalizeMongoScopeValues,
  resolveMaxDepth,
  validateMongoConnectionValues,
} from "@/lib/discovery/mongodb/connection-values";
import { flattenDocument, mergeFieldMaps } from "@/lib/discovery/mongodb/flatten";
import { triageFieldPath } from "@/lib/discovery/shared/name-triage";
import {
  detectPiiInValuesDetailed,
  type DetectionAggregate,
} from "@/lib/discovery/pii-detectors";
import type {
  CollectionCatalog,
  CoverageIssue,
  CoverageSummary,
  Finding,
  MongoConnectionValues,
  MongoScanResultPayload,
  MongoScopeValues,
} from "@/lib/discovery/mongodb/types";
import {
  DETECTOR_VERSION,
  MAX_COLLECTIONS,
  MAX_DOCS_PER_COLLECTION,
  MAX_DOCS_PER_COLLECTION_FULL,
  SCANNER_VERSION,
} from "@/lib/discovery/mongodb/types";
import type { PiiCategory } from "@/lib/discovery-mock-data";

export { validateMongoConnectionValues, normalizeMongoScopeValues };

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

function resolveSampleSize(
  estimatedDocs: number,
  scope: MongoScopeValues,
): { limit: number; rate: number; capped: boolean } {
  const full = scope.coverageMode === "full";
  const rate = Number.parseFloat(
    (full ? scope.samplingRateFull : scope.samplingRate) ?? (full ? "100" : "1"),
  );
  const safeRate = Number.isFinite(rate) && rate > 0 ? Math.min(rate, 100) : 1;
  const hardCap = full ? MAX_DOCS_PER_COLLECTION_FULL : MAX_DOCS_PER_COLLECTION;
  if (estimatedDocs <= 0) {
    return { limit: Math.min(50, hardCap), rate: safeRate, capped: false };
  }
  const target = Math.max(1, Math.ceil((estimatedDocs * safeRate) / 100));
  return {
    limit: Math.min(target, hardCap),
    rate: safeRate,
    capped: target > hardCap,
  };
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

function mergeCollectionFindings(
  collectionName: string,
  database: string,
  fieldFindings: FieldFinding[],
): Finding[] {
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
      item.content && item.sampledRecords > 0
        ? item.content.matchedRecords / item.sampledRecords
        : undefined;

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
        checksumBacked || (item.content!.matchedRecords >= 3 && (matchRate ?? 0) >= 0.2)
          ? "high"
          : "medium";
    }

    const location = `${database}.${collectionName}.${item.fieldPath}`;
    const signals = [
      ...(item.nameSignals ?? []),
      ...(hasContent ? (["value_pattern"] as const) : []),
      ...(checksumBacked ? (["checksum"] as const) : []),
    ];

    findings.push({
      location,
      piiType: item.piiType,
      confidence,
      detectedVia,
      category: item.category,
      riskLevel: riskForCategory(item.category),
      detectionSignals: [...new Set(signals)],
      evidence: {
        sampledRecords: item.sampledRecords,
        matchedRecords: item.content?.matchedRecords,
        matchRate,
        validators,
        reasons: [
          ...(item.nameReasons ?? []),
          ...(item.content?.reasons ?? []),
        ],
        rawValuesStored: false,
      },
      asset: {
        connectorId: "mongodb",
        assetType: "document_collection",
        name: `${database}.${collectionName}`,
        database,
      },
      field: { name: item.fieldPath, path: location },
    });
  }

  return findings;
}

async function scanCollection(
  client: MongoClient,
  database: string,
  collection: CollectionCatalog,
  scope: MongoScopeValues,
): Promise<{ findings: Finding[]; sampledDocs: number; matchedRecords: number; capped: boolean }> {
  const coll = client.db(database).collection(collection.name);
  const { limit, capped } = resolveSampleSize(collection.estimatedDocs, scope);
  const maxDepth = resolveMaxDepth(scope.maxDepth);

  const docs =
    scope.coverageMode === "full" && limit >= collection.estimatedDocs
      ? await coll.find({}).limit(limit).toArray()
      : await coll.aggregate([{ $sample: { size: limit } }]).toArray();

  const fieldMap = mergeFieldMaps(
    docs.map((doc) => flattenDocument(doc as Record<string, unknown>, maxDepth)),
  );

  const fieldFindingsByType = new Map<string, FieldFinding>();

  for (const [fieldPath, values] of fieldMap) {
    const nameHit =
      scope.nameTriage === "heuristics" || scope.nameTriage === "heuristics_llm"
        ? triageFieldPath(fieldPath, `${collection.name} ${fieldPath}`)
        : null;

    const detected = await detectPiiInValuesDetailed(values.flat());
    const types = new Set<string>([
      ...(nameHit ? [nameHit.piiType] : []),
      ...detected.keys(),
    ]);

    for (const piiType of types) {
      const key = `${fieldPath}|${piiType}`;
      const content = detected.get(piiType);
      fieldFindingsByType.set(key, {
        fieldPath,
        piiType,
        category: (nameHit?.piiType === piiType ? nameHit.category : content?.category) as
          | PiiCategory
          | undefined,
        nameConfidence: nameHit?.piiType === piiType ? nameHit.confidence : undefined,
        nameSignals: nameHit?.piiType === piiType ? nameHit.signals : undefined,
        nameReasons: nameHit?.piiType === piiType ? nameHit.reasons : undefined,
        content,
        sampledRecords: docs.length,
      });
    }
  }

  const matchedRecords = [...fieldFindingsByType.values()].reduce(
    (sum, item) => sum + (item.content?.matchedRecords ?? 0),
    0,
  );

  return {
    findings: mergeCollectionFindings(collection.name, database, [...fieldFindingsByType.values()]),
    sampledDocs: docs.length,
    matchedRecords,
    capped,
  };
}

export async function runMongoScan(
  connection: MongoConnectionValues,
  scope: MongoScopeValues,
): Promise<MongoScanResultPayload> {
  const startedAt = new Date();

  return withMongoClient(connection, async (client) => {
    const collections = await catalogCollections(client, connection.database, scope);
    const findings: Finding[] = [];
    const issues: CoverageIssue[] = [];
    let scanned = 0;
    let sampledRecords = 0;
    let matchedRecords = 0;
    let cappedCount = 0;

    if (collections.length >= MAX_COLLECTIONS) {
      cappedCount += 1;
      issues.push({
        asset: "catalog",
        status: "capped",
        reason: `Catalog limited to first ${MAX_COLLECTIONS} collections`,
      });
    }

    for (const collection of collections) {
      try {
        const result = await scanCollection(client, connection.database, collection, scope);
        scanned += 1;
        sampledRecords += result.sampledDocs;
        matchedRecords += result.matchedRecords;
        findings.push(...result.findings);
        if (result.capped) {
          cappedCount += 1;
          issues.push({
            asset: collection.name,
            status: "capped",
            reason: `Sample capped at ${result.sampledDocs} documents`,
            sampledRecords: result.sampledDocs,
            estimatedRecords: collection.estimatedDocs,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "query failed";
        const isPermission = /not authorized|permission/i.test(message);
        issues.push({
          asset: collection.name,
          status: isPermission ? "permission_denied" : "skipped",
          reason: isPermission ? "permission denied" : message,
          estimatedRecords: collection.estimatedDocs,
        });
      }
    }

    findings.sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
      return a.location.localeCompare(b.location);
    });

    const coverage: CoverageSummary = {
      assetsDiscovered: collections.length,
      assetsScanned: scanned,
      assetsSkipped: collections.length - scanned,
      assetsPartial: 0,
      assetsCapped: cappedCount,
      fieldsScanned: findings.length,
      sampledRecords,
      matchedRecords,
      rawValuesStored: false,
    };

    const completedAt = new Date();
    const rate =
      scope.coverageMode === "full" ? (scope.samplingRateFull ?? "100") : (scope.samplingRate ?? "1");

    return {
      scanRun: {
        id: globalThis.crypto?.randomUUID?.() ?? `scan-${completedAt.getTime().toString(36)}`,
        connectorId: "mongodb",
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        scannerVersion: SCANNER_VERSION,
        detectorVersion: DETECTOR_VERSION,
        mode: scope.coverageMode ?? "sample",
      },
      scopeLabel: "Collections catalogued",
      scopeValue: collections.length,
      findings,
      coverage,
      coverageIssues: issues,
      coverageLine:
        collections.length === 0
          ? "No collections matched the selected scope."
          : `${scanned} of ${collections.length} collections sampled; ${sampledRecords} documents sampled at ${rate}% target${
              issues.length > 0 ? ` — ${issues.length} coverage issue(s)` : ""
            }`,
      methodNote: `Collection catalog → sampled document field-path triage (${
        scope.nameTriage === "heuristics_llm" ? "heuristics + LLM" : "heuristics"
      }) → OpenRedaction (in-process). Types only; no document values stored.`,
    };
  });
}

export function safeMongoScanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Scan failed";
  const message = error.message;
  if (/auth failed|authentication|Unauthorized|bad auth/i.test(message)) {
    return "Authentication failed — check username, password, and auth source";
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|server selection/i.test(message)) {
    return "Could not connect to the host — check host, port, and network access";
  }
  if (/tls|ssl|certificate/i.test(message)) {
    return "TLS connection failed — try disabling TLS or check server certificates";
  }
  if (/is required|Invalid/i.test(message)) {
    return message;
  }
  return "Scan failed — could not complete the MongoDB discovery run";
}
