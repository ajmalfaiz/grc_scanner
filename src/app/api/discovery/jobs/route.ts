import { NextResponse } from "next/server";

import type { ConnectorId } from "@/lib/discovery-mock-data";
import { supportsLiveDiscovery } from "@/lib/discovery/live";
import { startScanJob } from "@/lib/jobs/job-store";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as {
    connectorId?: string;
    connectionValues?: Record<string, string>;
    scopeValues?: Record<string, string>;
    label?: string;
  };

  const connectorId = record.connectorId as ConnectorId | undefined;
  if (!connectorId || !supportsLiveDiscovery(connectorId)) {
    return NextResponse.json({ error: "connectorId is required and must be a live connector" }, { status: 400 });
  }
  if (!record.connectionValues || typeof record.connectionValues !== "object") {
    return NextResponse.json({ error: "connectionValues is required" }, { status: 400 });
  }

  const job = startScanJob({
    connectorId,
    connectionValues: record.connectionValues,
    scopeValues: record.scopeValues ?? {},
    label: record.label,
  });

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
}
