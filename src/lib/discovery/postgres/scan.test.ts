import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectPiiInValue,
  detectPiiInValues,
} from "@/lib/discovery/postgres/pii-detectors";
import {
  triageColumn,
  triageColumnsWithOptionalLlm,
} from "@/lib/discovery/postgres/name-triage";
import {
  parseSchemaList,
  quoteIdent,
} from "@/lib/discovery/postgres/identifiers";
import {
  resolveSampleLimit,
  resolveSamplingRate,
} from "@/lib/discovery/postgres/sample";
import { safeScanErrorMessage, validatePostgresConnectionValues } from "@/lib/discovery/postgres/scan";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("postgres identifiers", () => {
  it("quotes safe identifiers and rejects invalid ones", () => {
    expect(quoteIdent("employees")).toBe('"employees"');
    expect(() => quoteIdent('evil"; drop')).toThrow(/Invalid identifier/);
  });

  it("parses schema lists", () => {
    expect(parseSchemaList(" public, hr ")).toEqual(["public", "hr"]);
    expect(parseSchemaList("")).toBeNull();
    expect(() => parseSchemaList("bad-schema")).toThrow(/Invalid schema/);
  });
});

describe("postgres name triage", () => {
  it("scores common PII column names", () => {
    expect(
      triageColumn({
        schema: "hr",
        table: "employees",
        column: "work_email",
        dataType: "character varying",
        udtName: "varchar",
      })?.piiType,
    ).toBe("Email");

    expect(
      triageColumn({
        schema: "hr",
        table: "employees",
        column: "aadhaar_number",
        dataType: "text",
        udtName: "text",
      })?.piiType,
    ).toBe("Aadhaar");

    expect(
      triageColumn({
        schema: "hr",
        table: "employees",
        column: "updated_at",
        dataType: "timestamp without time zone",
        udtName: "timestamp",
      }),
    ).toBeNull();
  });

  it("uses negative patterns for common false positives", () => {
    expect(
      triageColumn({
        schema: "app",
        table: "ui_settings",
        column: "panel_width",
        dataType: "integer",
        udtName: "int4",
      }),
    ).toBeNull();
  });

  it("does not call Gemini when the API key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("DISCOVERY_ALLOW_EXTERNAL_LLM", "true");

    const result = await triageColumnsWithOptionalLlm(
      [
        {
          schema: "public",
          table: "customers",
          column: "email",
          dataType: "text",
          udtName: "text",
        },
      ],
      "heuristics_llm",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.llmAssistUsed).toBe(false);
    expect(result.hits[0]?.piiType).toBe("Email");
  });

  it("keeps LLM assist off by default even when an API key exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("DISCOVERY_ALLOW_EXTERNAL_LLM", "");

    const result = await triageColumnsWithOptionalLlm(
      [
        {
          schema: "public",
          table: "customers",
          column: "email",
          dataType: "text",
          udtName: "text",
        },
      ],
      "heuristics_llm",
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.llmAssistUsed).toBe(false);
  });

  it("uses Gemini metadata assist without sending sampled values", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("DISCOVERY_ALLOW_EXTERNAL_LLM", "true");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    hits: [
                      {
                        id: "0",
                        piiType: "UPI ID",
                        confidence: "medium",
                        category: "financial",
                        score: 72,
                        reason: "vpa-like payment metadata",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triageColumnsWithOptionalLlm(
      [
        {
          schema: "payments",
          table: "beneficiaries",
          column: "payment_handle",
          dataType: "text",
          udtName: "text",
        },
      ],
      "heuristics_llm",
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const prompt = requestBody.contents[0].parts[0].text as string;
    expect(prompt).toContain("payment_handle");
    expect(prompt).not.toContain("alice@okhdfcbank");
    expect(result.llmAssistUsed).toBe(true);
    expect(result.hits[0]?.piiType).toBe("UPI ID");
    expect(result.hits[0]?.reasons?.[0]).toMatch(/Gemini metadata assist/);
  });
});

describe("postgres PII detectors", () => {
  async function detectedTypes(value: unknown) {
    return (await detectPiiInValue(value)).map((match) => match.piiType);
  }

  it("detects common PII without returning raw values", async () => {
    expect(await detectedTypes("jane.doe@jethur.in")).toEqual(["Email"]);
    expect(await detectedTypes("Aadhaar 2345 6789 0124")).toContain("Aadhaar");
    expect(await detectedTypes("Mobile 9876543210")).toContain("Phone number");
    expect(await detectedTypes("John Smith")).toContain("Person name");
    expect(await detectPiiInValue("not sensitive")).toEqual([]);
  });

  it.each([
    ["email address", "Contact jane.doe@jethur.in", "Email"],
    ["Aadhaar with context", "Aadhaar 2345 6789 0124", "Aadhaar"],
    ["phone number", "Mobile 9876543210", "Phone number"],
    ["credit card with Luhn", "Card 4111 1111 1111 1111", "Credit card"],
    ["street address", "12 MG Road Koramangala Bengaluru", "Physical address"],
    ["person name", "John Smith", "Person name"],
    ["IPv4 address", "IP 8.8.8.8", "IP address"],
  ])("detects %s", async (_label, input, expectedType) => {
    expect(await detectedTypes(input)).toContain(expectedType);
  });

  it.each([
    ["plain non-PII text", "warehouse inventory count", "Email"],
    ["invalid Luhn card", "Card 4111 1111 1111 1112", "Credit card"],
  ])("rejects %s", async (_label, input, rejectedType) => {
    expect(await detectedTypes(input)).not.toContain(rejectedType);
  });

  it("uses OpenRedaction detector ids and never returns raw values", async () => {
    const matches = await detectPiiInValue("Email jane.doe@jethur.in");
    expect(matches.filter((match) => match.piiType === "Email")).toHaveLength(1);
    expect(matches[0]?.detectorId).toMatch(/^openredaction\./);
    expect(JSON.stringify(matches)).not.toContain("jane.doe@jethur.in");
  });

  it("aggregates hit counts across values", async () => {
    const counts = await detectPiiInValues([
      "a@company.com",
      "b@company.com",
      "plain",
    ]);
    expect(counts.get("Email")).toBe(2);
  });
});

describe("postgres sampling helpers", () => {
  it("resolves rate from scope mode", () => {
    expect(
      resolveSamplingRate({ coverageMode: "sample", samplingRate: "5" }),
    ).toBe(5);
    expect(
      resolveSamplingRate({
        coverageMode: "full",
        samplingRateFull: "50",
      }),
    ).toBe(50);
  });

  it("caps sample limit for sampled scans, not deep scans", () => {
    expect(resolveSampleLimit(10_000, 100)).toBe(200);
    expect(resolveSampleLimit(100, 1)).toBe(1);
    expect(resolveSampleLimit(10_000, 100, { maxRows: null })).toBe(10_000);
    expect(resolveSampleLimit(10_000, 50, { maxRows: null })).toBe(5_000);
  });
});

describe("safeScanErrorMessage", () => {
  it("maps common driver errors to safe copy", () => {
    expect(
      safeScanErrorMessage(new Error("password authentication failed for user")),
    ).toMatch(/Authentication failed/);
    expect(
      safeScanErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
    ).toMatch(/Could not connect/);
  });
});

describe("validatePostgresConnectionValues", () => {
  it("allows an empty password for trust/peer auth", () => {
    expect(
      validatePostgresConnectionValues({
        host: "localhost",
        port: "5432",
        database: "pest_control_crm",
        username: "ajmalfaiz",
        password: "",
        sslMode: "prefer",
      }),
    ).toMatchObject({
      host: "localhost",
      username: "ajmalfaiz",
      password: "",
    });
  });

  it("still requires host, port, username, and a database selection", () => {
    expect(() =>
      validatePostgresConnectionValues({
        host: "localhost",
        port: "5432",
        database: "",
        username: "ajmalfaiz",
        password: "",
      }),
    ).toThrow(/database is required/);

    expect(
      validatePostgresConnectionValues({
        host: "localhost",
        port: "5432",
        username: "ajmalfaiz",
        password: "",
        databaseMode: "all",
      }),
    ).toMatchObject({
      host: "localhost",
      database: "postgres",
      username: "ajmalfaiz",
    });
  });

  it("accepts a Postgres connection string", () => {
    expect(
      validatePostgresConnectionValues({
        connectionMode: "connectionString",
        connectionString:
          "postgresql://reader:secret@db.local:6543/app?sslmode=require",
      }),
    ).toMatchObject({
      host: "db.local",
      port: "6543",
      database: "app",
      username: "reader",
      password: "secret",
      sslMode: "require",
    });
  });

  it("rejects malformed Postgres connection strings", () => {
    expect(() =>
      validatePostgresConnectionValues({
        connectionMode: "connectionString",
        connectionString: "mysql://reader:secret@db.local/app",
      }),
    ).toThrow(/Invalid Postgres connection string protocol/);
  });
});
