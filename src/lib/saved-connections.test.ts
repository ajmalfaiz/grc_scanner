import { beforeEach, describe, expect, it } from "vitest";
import {
  buildConnectionLabel,
  buildConnectionSummary,
  buildScopeSummary,
  getSavedConnection,
  hasUsableStoredSecrets,
  loadDiscoveryDraft,
  listSavedConnections,
  removeSavedConnection,
  resetSavedConnectionsStoreForTests,
  saveDiscoveryDraft,
  clearDiscoveryDraft,
  SECRET_FIELD_NAMES,
  touchSavedConnection,
  updateSavedConnection,
  upsertSavedConnection,
} from "@/lib/saved-connections";

describe("saved connections", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
  });

  it("builds human-readable labels and summaries", () => {
    expect(
      buildConnectionLabel("postgres", {
        host: "db.local",
        database: "app",
      }),
    ).toBe("Postgres · db.local / app");

    expect(
      buildConnectionSummary({
        host: "db.local",
        port: "5432",
        database: "app",
        username: "reader",
      }),
    ).toContain("db.local:5432");

    expect(
      buildScopeSummary({ coverageMode: "sample", samplingRate: "1" }),
    ).toBe("Sampled scan · 1% rows/docs");
  });

  it("saves a connection and redacts secrets by default", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        port: "5432",
        database: "hr",
        username: "reader",
        password: "super-secret",
        sslMode: "prefer",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        nameTriage: "heuristics_llm",
        sampleMethod: "random",
        contentTargets: "ranked_plus_freetext",
        excludeSystemSchemas: "yes",
      },
    });

    expect(saved.storeSecrets).toBe(false);
    expect(saved.connectionValues.password).toBe("");
    expect(SECRET_FIELD_NAMES.has("password")).toBe(true);
    expect(listSavedConnections()).toHaveLength(1);
    expect(getSavedConnection(saved.id)?.label).toContain("Postgres");
  });

  it("normalizes a Postgres connection string before persisting", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        connectionMode: "connectionString",
        connectionString:
          "postgresql://reader:super-secret@db.local:6543/hr?sslmode=require",
      },
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
    });

    expect(saved.label).toBe("Postgres · db.local / hr");
    expect(saved.connectionSummary).toContain("db.local:6543");
    expect(saved.connectionValues.connectionMode).toBe("connectionString");
    expect(saved.connectionValues.connectionString).toBe("");
    expect(saved.connectionValues.password).toBe("");
    expect(hasUsableStoredSecrets(saved)).toBe(false);
  });

  it("can remember a Postgres connection string when secrets are saved", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      storeSecrets: true,
      connectionValues: {
        connectionMode: "connectionString",
        connectionString:
          "postgresql://reader:super-secret@db.local:6543/hr?sslmode=require",
      },
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
    });

    expect(saved.connectionValues.connectionMode).toBe("connectionString");
    expect(saved.connectionValues.connectionString).toContain("super-secret");
    expect(saved.connectionValues.password).toBe("super-secret");
    expect(hasUsableStoredSecrets(saved)).toBe(true);
  });

  it("persists secrets only when storeSecrets is explicitly enabled", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      storeSecrets: true,
      connectionValues: {
        host: "localhost",
        port: "5432",
        database: "hr",
        username: "reader",
        password: "super-secret",
        sslMode: "prefer",
      },
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
    });

    expect(saved.storeSecrets).toBe(true);
    expect(saved.connectionValues.password).toBe("super-secret");
    expect(hasUsableStoredSecrets(saved)).toBe(true);

    const cleared = updateSavedConnection({
      id: saved.id,
      storeSecrets: false,
      connectionValues: saved.connectionValues,
    });
    expect(cleared?.storeSecrets).toBe(false);
    expect(cleared?.connectionValues.password).toBe("");
    expect(hasUsableStoredSecrets(cleared!)).toBe(false);
  });

  it("updates an existing connection on upsert with id", () => {
    const first = upsertSavedConnection({
      connectorId: "mysql",
      connectionValues: { host: "a", database: "db", username: "u", password: "p", port: "3306", sslMode: "preferred" },
      scopeValues: { coverageMode: "sample", samplingRate: "1", sampleMethod: "random", nameTriage: "heuristics", contentTargets: "ranked_only", excludeSystemSchemas: "yes" },
    });

    const second = upsertSavedConnection({
      id: first.id,
      connectorId: "mysql",
      connectionValues: { host: "b", database: "db2", username: "u", password: "p2", port: "3306", sslMode: "preferred" },
      scopeValues: { coverageMode: "full", samplingRateFull: "100", sampleMethod: "random", nameTriage: "heuristics", contentTargets: "all_columns", excludeSystemSchemas: "yes" },
    });

    expect(second.id).toBe(first.id);
    expect(listSavedConnections()).toHaveLength(1);
    expect(second.connectionValues.host).toBe("b");
    expect(second.scopeValues.coverageMode).toBe("full");
  });

  it("updates connection settings without touching lastScannedAt by default", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        database: "hr",
        username: "u",
        password: "",
        port: "5432",
        sslMode: "prefer",
      },
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
    });

    const before = saved.lastScannedAt;
    const updated = updateSavedConnection({
      id: saved.id,
      connectionValues: {
        ...saved.connectionValues,
        host: "db.internal",
      },
      scopeValues: { coverageMode: "full", samplingRateFull: "100" },
    });

    expect(updated?.connectionValues.host).toBe("db.internal");
    expect(updated?.scopeValues.coverageMode).toBe("full");
    expect(updated?.lastScannedAt).toBe(before);

    const rescanned = updateSavedConnection({
      id: saved.id,
      touchScan: true,
      scopeValues: { coverageMode: "sample", samplingRate: "5" },
    });
    expect(rescanned!.lastScannedAt >= before).toBe(true);
  });

  it("touches lastScannedAt and removes connections", () => {
    const saved = upsertSavedConnection({
      connectorId: "mongodb",
      connectionValues: { host: "m", database: "d", username: "u", password: "p", port: "27017", tls: "true", authSource: "admin" },
      scopeValues: { coverageMode: "sample", samplingRate: "1", nameTriage: "heuristics", maxDepth: "3" },
    });

    const before = saved.lastScannedAt;
    const touched = touchSavedConnection(saved.id);
    expect(touched?.lastScannedAt >= before).toBe(true);

    removeSavedConnection(saved.id);
    expect(listSavedConnections()).toHaveLength(0);
    expect(touchSavedConnection(saved.id)).toBeUndefined();
  });

  it("stores and clears discovery drafts in sessionStorage", () => {
    saveDiscoveryDraft({
      connectorId: "postgres",
      connectionValues: { host: "x", password: "secret" },
      scopeValues: { coverageMode: "sample" },
    });

    const draft = loadDiscoveryDraft();
    expect(draft?.connectorId).toBe("postgres");
    expect(draft?.storeSecrets).toBe(false);
    // Wizard draft keeps secrets so the next step can run a live scan.
    expect(draft?.connectionValues.password).toBe("secret");

    clearDiscoveryDraft();
    expect(loadDiscoveryDraft()).toBeNull();
  });

  it("keeps secrets in the draft for the wizard session", () => {
    saveDiscoveryDraft({
      connectorId: "postgres",
      storeSecrets: true,
      connectionValues: { host: "x", password: "secret" },
    });

    expect(loadDiscoveryDraft()?.connectionValues.password).toBe("secret");
  });

  it("persists lastScanResult on upsert and touch", () => {
    const result = {
      scopeLabel: "Tables catalogued",
      scopeValue: 1,
      findings: [
        {
          location: "public.users.email",
          piiType: "Email",
          confidence: "high" as const,
          detectedVia: "both" as const,
        },
      ],
      coverageLine:
        "All 1 scoped tables were sampled — sampled tables used the selected 1% row target",
      methodNote: "test",
    };

    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        port: "5432",
        database: "hr",
        username: "u",
        password: "p",
        sslMode: "prefer",
      },
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
      lastScanResult: result,
    });

    expect(saved.lastScanResult?.findings).toHaveLength(1);

    const touched = touchSavedConnection(saved.id, {
      ...result,
      scopeValue: 3,
    });
    expect(touched?.lastScanResult?.scopeValue).toBe(3);
  });
});
