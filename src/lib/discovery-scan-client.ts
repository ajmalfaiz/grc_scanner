import type { ConnectorId, Finding } from "@/lib/discovery-mock-data";
import { supportsLiveDiscovery } from "@/lib/discovery/live";
import type { SavedScanResult } from "@/lib/saved-connections";

export type DiscoveryScanResponse = SavedScanResult;

export type DiscoveryConnectionTestResponse = {
  ok: true;
  serverVersion: string;
  message: string;
  details?: Record<string, string>;
};

export type DiscoveryDatabasesResponse = {
  ok: true;
  databases: string[];
  message: string;
};

function scanApiPath(connectorId: ConnectorId): string {
  if (connectorId === "postgres") return "/api/discovery/postgres/scan";
  if (connectorId === "file-server") return "/api/discovery/file-server/scan";
  throw new Error(`Live scan is not implemented for ${connectorId}`);
}

function testApiPath(connectorId: ConnectorId): string {
  if (connectorId === "postgres") return "/api/discovery/postgres/test";
  if (connectorId === "file-server") return "/api/discovery/file-server/test";
  throw new Error(`Connection test is not implemented for ${connectorId}`);
}

export async function testDiscoveryConnection(input: {
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
}): Promise<DiscoveryConnectionTestResponse> {
  if (!supportsLiveDiscovery(input.connectorId)) {
    throw new Error(
      `Connection test is not implemented for ${input.connectorId}`,
    );
  }

  const res = await fetch(testApiPath(input.connectorId), {
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
    details?: Record<string, string>;
  };

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Connection test failed");
  }

  return {
    ok: true,
    serverVersion: data.serverVersion ?? "unknown",
    message:
      data.message ??
      `Connected successfully (${data.serverVersion ?? "unknown"})`,
    details: data.details,
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
  if (!supportsLiveDiscovery(input.connectorId)) {
    throw new Error(`Live scan is not implemented for ${input.connectorId}`);
  }

  const res = await fetch(scanApiPath(input.connectorId), {
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
