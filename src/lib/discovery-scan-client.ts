import type { ConnectorId, Finding } from "@/lib/discovery-mock-data";
import { supportsDatabasePicker, supportsLiveDiscovery } from "@/lib/discovery/live";
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
  if (supportsLiveDiscovery(connectorId)) return `/api/discovery/${connectorId}/scan`;
  throw new Error(`Live scan is not implemented for ${connectorId}`);
}

function testApiPath(connectorId: ConnectorId): string {
  if (supportsLiveDiscovery(connectorId)) return `/api/discovery/${connectorId}/test`;
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
  if (!supportsDatabasePicker(input.connectorId)) {
    throw new Error(
      `Listing databases is not implemented for ${input.connectorId}`,
    );
  }

  const res = await fetch(`/api/discovery/${input.connectorId}/databases`, {
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

export type DiscoveryJobStatus = "queued" | "running" | "completed" | "failed";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a scan as a server-side background job instead of one long-lived HTTP
 * request — a large source no longer has to finish inside a single request's
 * timeout window. Starts the job, then polls until it completes or fails.
 */
export async function runDiscoveryScanJob(
  input: {
    connectorId: ConnectorId;
    connectionValues: Record<string, string>;
    scopeValues: Record<string, string>;
    label?: string;
  },
  options?: {
    onStatus?: (status: DiscoveryJobStatus) => void;
    pollIntervalMs?: number;
    signal?: AbortSignal;
  },
): Promise<DiscoveryScanResponse> {
  if (!supportsLiveDiscovery(input.connectorId)) {
    throw new Error(`Live scan is not implemented for ${input.connectorId}`);
  }

  const startRes = await fetch("/api/discovery/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectorId: input.connectorId,
      connectionValues: input.connectionValues,
      scopeValues: input.scopeValues,
      label: input.label,
    }),
    signal: options?.signal,
  });

  const started = (await startRes.json().catch(() => ({}))) as {
    jobId?: string;
    error?: string;
  };
  if (!startRes.ok || !started.jobId) {
    throw new Error(started.error ?? "Could not start scan");
  }

  const pollIntervalMs = options?.pollIntervalMs ?? 1200;

  while (true) {
    await sleep(pollIntervalMs);
    if (options?.signal?.aborted) {
      throw new Error("Scan cancelled");
    }

    const pollRes = await fetch(`/api/discovery/jobs/${started.jobId}`, {
      signal: options?.signal,
    });
    const job = (await pollRes.json().catch(() => ({}))) as {
      status?: DiscoveryJobStatus;
      error?: string;
      result?: {
        scanRun?: SavedScanResult["scanRun"];
        scopeLabel?: string;
        scopeValue?: number;
        findings?: Finding[];
        coverage?: SavedScanResult["coverage"];
        coverageIssues?: SavedScanResult["coverageIssues"];
        coverageLine?: string;
        methodNote?: string;
      };
    };

    if (!pollRes.ok || !job.status) {
      throw new Error(job.error ?? "Lost track of the running scan");
    }

    options?.onStatus?.(job.status);

    if (job.status === "failed") {
      throw new Error(job.error ?? "Scan failed");
    }

    if (job.status === "completed") {
      const result = job.result;
      if (
        !result ||
        typeof result.scopeLabel !== "string" ||
        typeof result.scopeValue !== "number" ||
        !Array.isArray(result.findings) ||
        typeof result.coverageLine !== "string" ||
        typeof result.methodNote !== "string"
      ) {
        throw new Error("Unexpected scan response");
      }
      return {
        scanRun: result.scanRun,
        scopeLabel: result.scopeLabel,
        scopeValue: result.scopeValue,
        findings: result.findings,
        coverage: result.coverage,
        coverageIssues: result.coverageIssues,
        coverageLine: result.coverageLine,
        methodNote: result.methodNote,
      };
    }
    // queued / running — keep polling.
  }
}
