import { OpenRedaction, type PIIDetection } from "openredaction";

export type DetectorMatch = {
  piiType: string;
  hitCount: number;
  detectorId: string;
  category: string;
  riskLevel: "high" | "medium" | "low";
  validators: string[];
  reasons: string[];
};

export type DetectionAggregate = {
  piiType: string;
  hitCount: number;
  matchedRecords: number;
  detectorIds: string[];
  category: string;
  riskLevel: "high" | "medium" | "low";
  validators: string[];
  reasons: string[];
};

type TypeMeta = {
  piiType: string;
  category: string;
  riskLevel: "high" | "medium" | "low";
};

/** Map OpenRedaction pattern types → product finding labels. */
const TYPE_MAP: Record<string, TypeMeta> = {
  EMAIL: { piiType: "Email", category: "contact", riskLevel: "high" },
  PHONE_UK: { piiType: "Phone number", category: "contact", riskLevel: "high" },
  PHONE_UK_MOBILE: {
    piiType: "Phone number",
    category: "contact",
    riskLevel: "high",
  },
  PHONE_US: { piiType: "Phone number", category: "contact", riskLevel: "high" },
  PHONE_INTERNATIONAL: {
    piiType: "Phone number",
    category: "contact",
    riskLevel: "high",
  },
  PHONE_LINE_NUMBER: {
    piiType: "Phone number",
    category: "contact",
    riskLevel: "medium",
  },
  CREDIT_CARD: {
    piiType: "Credit card",
    category: "financial",
    riskLevel: "high",
  },
  IBAN: { piiType: "IBAN", category: "financial", riskLevel: "high" },
  IFSC: { piiType: "IFSC", category: "financial", riskLevel: "medium" },
  INDIAN_AADHAAR: {
    piiType: "Aadhaar",
    category: "government_id",
    riskLevel: "high",
  },
  NAME: {
    piiType: "Person name",
    category: "direct_identifier",
    riskLevel: "medium",
  },
  ADDRESS_STREET: {
    piiType: "Physical address",
    category: "location",
    riskLevel: "medium",
  },
  ADDRESS_PO_BOX: {
    piiType: "Physical address",
    category: "location",
    riskLevel: "medium",
  },
  IPV4: { piiType: "IP address", category: "network", riskLevel: "low" },
  IPV6: { piiType: "IP address", category: "network", riskLevel: "low" },
  IP_ADDRESS: { piiType: "IP address", category: "network", riskLevel: "low" },
  SSN: { piiType: "US SSN", category: "government_id", riskLevel: "high" },
  US_SSN: { piiType: "US SSN", category: "government_id", riskLevel: "high" },
  ZIP_CODE_US: {
    piiType: "Postal code",
    category: "location",
    riskLevel: "low",
  },
};

/** Gaming / crypto noise that adds little for DB governance discovery. */
const IGNORED_TYPES = new Set([
  "XBOX_GAMERTAG",
  "PSN_ID",
  "NINTENDO_FRIEND_CODE",
  "STEAM_ID",
  "DISCORD_TOKEN",
  "TIKTOK_USERNAME",
  "INSTAGRAM_USERNAME",
  "SOCIAL_MEDIA_HANDLE",
  "BITCOIN_ADDRESS",
  "ETHEREUM_ADDRESS",
  "SOLANA_ADDRESS",
  "LITECOIN_ADDRESS",
  "MONERO_ADDRESS",
  "RIPPLE_ADDRESS",
  "CARDANO_ADDRESS",
  "POLKADOT_ADDRESS",
  "AVALANCHE_ADDRESS",
  "POLYGON_ADDRESS",
  "BINANCE_CHAIN_ADDRESS",
  "COSMOS_ADDRESS",
  "ALGORAND_ADDRESS",
  "TEZOS_ADDRESS",
  "NEAR_ADDRESS",
  "DELAWARE_LICENSE_PLATE",
  "INDIANA_LICENSE_PLATE",
  "JAPANESE_LICENSE_PLATE",
  "EPIC_GAMES_ID",
]);

let detector: OpenRedaction | null = null;

function getDetector(): OpenRedaction {
  detector ??= new OpenRedaction({
    includeNames: true,
    includeAddresses: true,
    includeEmails: true,
    includePhones: true,
    // Prefer recall for discovery scans; name triage still handles schema signals.
    confidenceThreshold: 0.35,
    enableContextAnalysis: true,
    enableFalsePositiveFilter: false,
    // Never audit/log raw values through OpenRedaction side channels.
    enableAuditLog: false,
    enableMetrics: false,
    debug: false,
  });
  return detector;
}

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return "";
}

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function severityToRisk(
  severity: PIIDetection["severity"] | undefined,
): "high" | "medium" | "low" {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function mapDetection(detection: PIIDetection): DetectorMatch | null {
  if (IGNORED_TYPES.has(detection.type)) return null;

  const mapped = TYPE_MAP[detection.type];
  const piiType = mapped?.piiType ?? humanizeType(detection.type);
  const category = mapped?.category ?? "free_text";
  const riskLevel = mapped?.riskLevel ?? severityToRisk(detection.severity);
  const confidence =
    typeof detection.confidence === "number"
      ? `confidence_${Math.round(detection.confidence * 100)}`
      : "confidence_unknown";

  return {
    piiType,
    hitCount: 1,
    detectorId: `openredaction.${detection.type.toLowerCase()}.v1`,
    category,
    riskLevel,
    validators: ["openredaction", confidence],
    reasons: [
      `OpenRedaction detected ${detection.type}${
        typeof detection.confidence === "number"
          ? ` (score ${detection.confidence.toFixed(2)})`
          : ""
      }`,
    ],
  };
}

function dedupeMatches(matches: DetectorMatch[]): DetectorMatch[] {
  const byType = new Map<string, DetectorMatch>();
  for (const match of matches) {
    const existing = byType.get(match.piiType);
    if (!existing) {
      byType.set(match.piiType, { ...match });
      continue;
    }
    existing.hitCount += match.hitCount;
    existing.validators = [
      ...new Set([...existing.validators, ...match.validators]),
    ];
    existing.reasons = [...new Set([...existing.reasons, ...match.reasons])];
  }
  return [...byType.values()];
}

/**
 * Detect PII types in a value via OpenRedaction (in-process, no network).
 * Never returns the raw matched value.
 */
export async function detectPiiInValue(
  value: unknown,
): Promise<DetectorMatch[]> {
  const text = valueToText(value);
  if (!text.trim()) return [];

  try {
    const result = await getDetector().detect(text);
    const matches = (result.detections ?? [])
      .map(mapDetection)
      .filter((match): match is DetectorMatch => match !== null);
    return dedupeMatches(matches);
  } catch {
    return [];
  }
}

export async function detectPiiInValuesDetailed(
  values: unknown[],
): Promise<Map<string, DetectionAggregate>> {
  const counts = new Map<string, DetectionAggregate>();

  for (const value of values) {
    const matchedTypesForRecord = new Set<string>();
    for (const match of await detectPiiInValue(value)) {
      const existing = counts.get(match.piiType) ?? {
        piiType: match.piiType,
        hitCount: 0,
        matchedRecords: 0,
        detectorIds: [],
        category: match.category,
        riskLevel: match.riskLevel,
        validators: [],
        reasons: [],
      };
      existing.hitCount += match.hitCount;
      if (!matchedTypesForRecord.has(match.piiType)) {
        existing.matchedRecords += 1;
        matchedTypesForRecord.add(match.piiType);
      }
      existing.detectorIds = [
        ...new Set([...existing.detectorIds, match.detectorId]),
      ];
      existing.validators = [
        ...new Set([...existing.validators, ...match.validators]),
      ];
      existing.reasons = [...new Set([...existing.reasons, ...match.reasons])];
      counts.set(match.piiType, existing);
    }
  }

  return counts;
}

export async function detectPiiInValues(
  values: unknown[],
): Promise<Map<string, number>> {
  const detailed = await detectPiiInValuesDetailed(values);
  return new Map(
    [...detailed.entries()].map(([piiType, aggregate]) => [
      piiType,
      aggregate.hitCount,
    ]),
  );
}
