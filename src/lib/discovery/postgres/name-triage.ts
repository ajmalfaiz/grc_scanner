import type {
  ColumnCatalog,
  Confidence,
  NameTriageHit,
  PiiCategory,
} from "@/lib/discovery/postgres/types";

type Rule = {
  piiType: string;
  confidence: Confidence;
  category: NameTriageHit["category"];
  namePatterns: RegExp[];
  dataTypes?: RegExp[];
  contextPatterns?: RegExp[];
  negativePatterns?: RegExp[];
};

type LlmTriageResponse = {
  hits?: Array<{
    id?: string;
    piiType?: string;
    confidence?: string;
    category?: string;
    score?: number;
    reason?: string;
  }>;
};

const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = 8_000;
const MAX_LLM_COLUMNS = 500;
const ALLOWED_CONFIDENCE = new Set<Confidence>(["high", "medium"]);
const ALLOWED_CATEGORIES = new Set<PiiCategory>([
  "direct_identifier",
  "government_id",
  "financial",
  "contact",
  "location",
  "network",
  "demographic",
  "free_text",
  "internal_identifier",
]);

const RULES: Rule[] = [
  {
    piiType: "Email",
    confidence: "high",
    category: "contact",
    namePatterns: [
      /e[-_]?mail/i,
      /email[_-]?addr/i,
      /work[_-]?email/i,
      /mail[_-]?id/i,
      /contact[_-]?email/i,
    ],
    negativePatterns: [/email[_-]?enabled/i, /email[_-]?verified/i],
  },
  {
    piiType: "Phone number",
    confidence: "high",
    category: "contact",
    namePatterns: [
      /phone/i,
      /mobile/i,
      /mobile[_-]?no/i,
      /cell[_-]?phone/i,
      /contact[_-]?number/i,
      /tel(ephone)?/i,
    ],
  },
  {
    piiType: "Aadhaar",
    confidence: "high",
    category: "government_id",
    namePatterns: [/aadhaar/i, /aadhar/i, /uidai/i, /national[_-]?id/i],
    contextPatterns: [/kyc/i, /identity/i, /customer/i, /employee/i],
  },
  {
    piiType: "PAN",
    confidence: "high",
    category: "government_id",
    namePatterns: [/\bpan\b/i, /pan[_-]?(number|no|card)/i, /tax[_-]?id/i],
    contextPatterns: [/kyc/i, /tax/i, /identity/i],
    negativePatterns: [/span/i, /panel/i, /campaign/i, /company/i],
  },
  {
    piiType: "Bank account number",
    confidence: "medium",
    category: "financial",
    namePatterns: [
      /bank[_-]?account/i,
      /account[_-]?(number|no)/i,
      /\biban\b/i,
      /routing[_-]?number/i,
    ],
    contextPatterns: [/bank/i, /payment/i, /payout/i, /vendor/i],
    negativePatterns: [/account[_-]?status/i, /account[_-]?type/i],
  },
  {
    piiType: "GSTIN",
    confidence: "high",
    category: "financial",
    namePatterns: [/gstin/i, /gst[_-]?(number|no|id)/i],
    contextPatterns: [/tax/i, /vendor/i, /invoice/i, /company/i],
  },
  {
    piiType: "IFSC",
    confidence: "high",
    category: "financial",
    namePatterns: [/\bifsc\b/i, /ifsc[_-]?code/i],
    contextPatterns: [/bank/i, /payment/i, /payout/i],
  },
  {
    piiType: "UPI ID",
    confidence: "high",
    category: "financial",
    namePatterns: [/\bupi\b/i, /\bvpa\b/i, /upi[_-]?(id|handle)/i],
    contextPatterns: [/payment/i, /payout/i, /bank/i],
  },
  {
    piiType: "Physical address",
    confidence: "medium",
    category: "location",
    namePatterns: [
      /address/i,
      /addr[_-]?line/i,
      /street/i,
      /postal[_-]?code/i,
      /zip[_-]?code/i,
    ],
    dataTypes: [/text|character|varchar|json/i],
  },
  {
    piiType: "Person name",
    confidence: "medium",
    category: "direct_identifier",
    namePatterns: [
      /full[_-]?name/i,
      /first[_-]?name/i,
      /last[_-]?name/i,
      /surname/i,
      /given[_-]?name/i,
      /display[_-]?name/i,
    ],
  },
  {
    piiType: "Date of birth",
    confidence: "medium",
    category: "demographic",
    namePatterns: [/dob\b/i, /date[_-]?of[_-]?birth/i, /birth[_-]?date/i],
  },
  {
    piiType: "SSN",
    confidence: "high",
    category: "government_id",
    namePatterns: [/\bssn\b/i, /social[_-]?security/i],
  },
  {
    piiType: "IP address",
    confidence: "medium",
    category: "network",
    namePatterns: [/ip[_-]?addr/i, /client[_-]?ip/i, /remote[_-]?ip/i],
  },
  {
    piiType: "Passport number",
    confidence: "high",
    category: "government_id",
    namePatterns: [/passport/i, /passport[_-]?(number|no)/i],
    contextPatterns: [/kyc/i, /identity/i],
  },
  {
    piiType: "Voter ID",
    confidence: "medium",
    category: "government_id",
    namePatterns: [/voter/i, /\bepic\b/i, /election[_-]?id/i],
    contextPatterns: [/kyc/i, /identity/i],
  },
  {
    piiType: "Driving licence",
    confidence: "medium",
    category: "government_id",
    namePatterns: [/driv(e|ing)[_-]?licen[cs]e/i, /\bdl[_-]?(number|no)\b/i],
    contextPatterns: [/kyc/i, /identity/i],
  },
  {
    piiType: "Indian pincode",
    confidence: "medium",
    category: "location",
    namePatterns: [/pin[_-]?code/i, /postal[_-]?code/i, /zip[_-]?code/i],
    contextPatterns: [/address/i, /location/i],
  },
  {
    piiType: "Customer ID",
    confidence: "medium",
    category: "internal_identifier",
    namePatterns: [/customer[_-]?id/i, /client[_-]?id/i],
    negativePatterns: [/external[_-]?system/i],
  },
  {
    piiType: "Employee ID",
    confidence: "medium",
    category: "internal_identifier",
    namePatterns: [/employee[_-]?id/i, /emp[_-]?(id|code|no)/i],
  },
];

const FREETEXT_TYPES = /^(text|character varying|varchar|json|jsonb|citext)$/i;

export function isFreeTextColumn(column: ColumnCatalog): boolean {
  return (
    FREETEXT_TYPES.test(column.dataType) || FREETEXT_TYPES.test(column.udtName)
  );
}

export function triageColumn(column: ColumnCatalog): NameTriageHit | null {
  const name = column.column;
  const locationBlob = `${column.schema} ${column.table} ${column.column}`;
  const typeBlob = `${column.dataType} ${column.udtName}`;
  let best: NameTriageHit | null = null;

  for (const rule of RULES) {
    const nameMatch = rule.namePatterns.some((pattern) => pattern.test(name));
    if (!nameMatch) continue;
    if (rule.negativePatterns?.some((pattern) => pattern.test(locationBlob))) {
      continue;
    }
    if (rule.dataTypes && !rule.dataTypes.some((pattern) => pattern.test(typeBlob))) {
      continue;
    }
    const contextMatch = rule.contextPatterns?.some((pattern) =>
      pattern.test(locationBlob),
    );
    const score = 60 + (rule.confidence === "high" ? 20 : 0) + (contextMatch ? 15 : 0);
    const hit: NameTriageHit = {
      column,
      piiType: rule.piiType,
      confidence: rule.confidence,
      category: rule.category,
      score,
      signals: contextMatch
        ? ["metadata_name", "metadata_context"]
        : ["metadata_name"],
      reasons: [
        `Column name matched ${rule.piiType} triage rule`,
        ...(contextMatch
          ? [`Schema/table context strengthened ${rule.piiType} signal`]
          : []),
      ],
    };
    if (!best || (hit.score ?? 0) > (best.score ?? 0)) {
      best = hit;
    }
  }
  return best;
}

export function triageColumns(columns: ColumnCatalog[]): NameTriageHit[] {
  const hits: NameTriageHit[] = [];
  for (const column of columns) {
    const hit = triageColumn(column);
    if (hit) hits.push(hit);
  }
  return hits;
}

function mergeTriageHits(hits: NameTriageHit[]): NameTriageHit[] {
  const byKey = new Map<string, NameTriageHit>();
  for (const hit of hits) {
    const key = `${hit.column.schema}.${hit.column.table}.${hit.column.column}|${hit.piiType}`;
    const existing = byKey.get(key);
    if (!existing || (hit.score ?? 0) > (existing.score ?? 0)) {
      byKey.set(key, {
        ...hit,
        reasons: [
          ...new Set([
            ...(existing?.reasons ?? []),
            ...(hit.reasons ?? []),
          ]),
        ],
        signals: [
          ...new Set([
            ...(existing?.signals ?? []),
            ...(hit.signals ?? []),
          ]),
        ],
      });
    } else {
      byKey.set(key, {
        ...existing,
        reasons: [
          ...new Set([
            ...(existing.reasons ?? []),
            ...(hit.reasons ?? []),
          ]),
        ],
        signals: [
          ...new Set([
            ...(existing.signals ?? []),
            ...(hit.signals ?? []),
          ]),
        ],
      });
    }
  }
  return [...byKey.values()];
}

function parseGeminiJson(text: string): LlmTriageResponse {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(withoutFence) as LlmTriageResponse;
}

function geminiPrompt(columns: ColumnCatalog[]): string {
  return [
    "You are a privacy data discovery classifier.",
    "Classify only from metadata: schema, table, column name, data type, and udt name.",
    "Never infer from sample values because no row/cell values are provided.",
    "Return strict JSON only with shape:",
    '{"hits":[{"id":"0","piiType":"Email","confidence":"high","category":"contact","score":85,"reason":"short reason"}]}',
    "Allowed confidence: high, medium.",
    `Allowed category: ${[...ALLOWED_CATEGORIES].join(", ")}.`,
    "Return hits only when metadata strongly suggests personal data.",
    "Prefer Indian DPDP-relevant types: Aadhaar, PAN, GSTIN, IFSC, UPI ID, Passport number, Voter ID, Driving licence, Phone number, Email, Person name, Date of birth, Physical address, Indian pincode, Bank account number, Customer ID, Employee ID, IP address.",
    "Avoid false positives for UI/config columns such as panel, span, campaign, dimensions, counters, flags, and timestamps.",
    `Columns: ${JSON.stringify(
      columns.slice(0, MAX_LLM_COLUMNS).map((column, index) => ({
        id: String(index),
        schema: column.schema,
        table: column.table,
        column: column.column,
        dataType: column.dataType,
        udtName: column.udtName,
      })),
    )}`,
  ].join("\n");
}

async function fetchGeminiTriage(
  columns: ColumnCatalog[],
): Promise<NameTriageHit[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || columns.length === 0) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    );
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: geminiPrompt(columns) }],
          },
        ],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) return [];
    const body = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    const parsed = parseGeminiJson(text);
    const columnsForPrompt = columns.slice(0, MAX_LLM_COLUMNS);
    const hits: NameTriageHit[] = [];
    for (const item of parsed.hits ?? []) {
      const column = columnsForPrompt[Number.parseInt(item.id ?? "", 10)];
      if (!column || !item.piiType) continue;
      const confidence = item.confidence as Confidence;
      const category = item.category as PiiCategory;
      if (!ALLOWED_CONFIDENCE.has(confidence)) continue;
      if (!ALLOWED_CATEGORIES.has(category)) continue;
      hits.push({
        column,
        piiType: item.piiType,
        confidence,
        category,
        score:
          typeof item.score === "number" && Number.isFinite(item.score)
            ? Math.max(0, Math.min(100, item.score))
            : confidence === "high"
              ? 82
              : 68,
        signals: ["metadata_name", "metadata_context"],
        reasons: [
          item.reason
            ? `Gemini metadata assist: ${item.reason}`
            : "Gemini metadata assist classified this column",
        ],
      });
    }
    return hits;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function triageColumnsWithOptionalLlm(
  columns: ColumnCatalog[],
  mode: string | undefined,
): Promise<{ hits: NameTriageHit[]; llmAssistUsed: boolean }> {
  const heuristicHits = triageColumns(columns);
  if (mode !== "heuristics_llm") {
    return { hits: heuristicHits, llmAssistUsed: false };
  }

  // Sampled cell values are never sent. Even metadata LLM assist is off unless
  // explicitly opted in — keeps discovery fully on-system by default.
  const allowExternal =
    process.env.DISCOVERY_ALLOW_EXTERNAL_LLM?.trim().toLowerCase() === "true";
  if (!allowExternal) {
    return { hits: heuristicHits, llmAssistUsed: false };
  }

  const llmHits = await fetchGeminiTriage(columns);
  return {
    hits: mergeTriageHits([...heuristicHits, ...llmHits]),
    llmAssistUsed: llmHits.length > 0,
  };
}
