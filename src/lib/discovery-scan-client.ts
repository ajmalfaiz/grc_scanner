import type { ConnectorId, Finding } from "@/lib/discovery-mock-data";
import type { SavedScanResult } from "@/lib/saved-connections";

export type DiscoveryScanResponse = SavedScanResult;

export type DiscoveryConnectionTestResponse = {
  ok: true;
  serverVersion: string;
  message: string;
};

export type DiscoveryDatabasesResponse = {
  ok: true;
  databases: string[];
  message: string;
};

export async function testDiscoveryConnection(input: {
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
}): Promise<DiscoveryConnectionTestResponse> {
  if (input.connectorId !== "postgres") {
    throw new Error(
      `Connection test is not implemented for ${input.connectorId}`,
    );
  }

  const res = await fetch("/api/discovery/postgres/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectionValues: input.connectionValues,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    serverVersion?: string;
    message?: string;
  };

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Connection test failed");
  }

  return {
    ok: true,
    serverVersion: data.serverVersion ?? "unknown",
    message:
      data.message ??
      `Connected successfully (PostgreSQL ${data.serverVersion ?? "unknown"})`,
  };
}

export async function listDiscoveryDatabases(input: {
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
}): Promise<DiscoveryDatabasesResponse> {
  if (input.connectorId !== "postgres") {
    throw new Error(
      `Listing databases is not implemented for ${input.connectorId}`,
    );
  }

  const res = await fetch("/api/discovery/postgres/databases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectionValues: input.connectionValues,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    databases?: string[];
    message?: string;
  };

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Could not list databases");
  }

  return {
    ok: true,
    databases: Array.isArray(data.databases) ? data.databases : [],
    message: data.message ?? "Databases loaded",
  };
}

export async function runDiscoveryScan(input: {
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
}): Promise<DiscoveryScanResponse> {
  if (input.connectorId !== "postgres") {
    throw new Error(`Live scan is not implemented for ${input.connectorId}`);
  }

  const res = await fetch("/api/discovery/postgres/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectionValues: input.connectionValues,
      scopeValues: input.scopeValues,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    scanRun?: SavedScanResult["scanRun"];
    scopeLabel?: string;
    scopeValue?: number;
    findings?: Finding[];
    coverage?: SavedScanResult["coverage"];
    coverageIssues?: SavedScanResult["coverageIssues"];
    coverageLine?: string;
    methodNote?: string;
  };

  if (!res.ok) {
    throw new Error(data.error ?? "Scan failed");
  }

  if (
    typeof data.scopeLabel !== "string" ||
    typeof data.scopeValue !== "number" ||
    !Array.isArray(data.findings) ||
    typeof data.coverageLine !== "string" ||
    typeof data.methodNote !== "string"
  ) {
    throw new Error("Unexpected scan response");
  }

  return {
    scanRun: data.scanRun,
    scopeLabel: data.scopeLabel,
    scopeValue: data.scopeValue,
    findings: data.findings,
    coverage: data.coverage,
    coverageIssues: data.coverageIssues,
    coverageLine: data.coverageLine,
    methodNote: data.methodNote,
  };
}
