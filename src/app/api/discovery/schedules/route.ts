import { NextResponse } from "next/server";

import type { ConnectorId } from "@/lib/discovery-mock-data";
import { supportsLiveDiscovery } from "@/lib/discovery/live";
import {
  createSchedule,
  ensureSchedulerRunning,
  listSchedules,
  toPublicSchedule,
} from "@/lib/jobs/schedule-store";

export async function GET() {
  ensureSchedulerRunning();
  return NextResponse.json({ schedules: listSchedules().map(toPublicSchedule) });
}

export async function POST(request: Request) {
  ensureSchedulerRunning();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as {
    connectorId?: string;
    label?: string;
    connectionValues?: Record<string, string>;
    scopeValues?: Record<string, string>;
    intervalMinutes?: number;
    savedConnectionId?: string;
  };

  const connectorId = record.connectorId as ConnectorId | undefined;
  if (!connectorId || !supportsLiveDiscovery(connectorId)) {
    return NextResponse.json({ error: "connectorId is required and must be a live connector" }, { status: 400 });
  }
  if (!record.connectionValues || typeof record.connectionValues !== "object") {
    return NextResponse.json({ error: "connectionValues is required" }, { status: 400 });
  }
  const intervalMinutes = Number(record.intervalMinutes);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return NextResponse.json({ error: "intervalMinutes must be a positive number" }, { status: 400 });
  }

  const schedule = createSchedule({
    connectorId,
    label: record.label?.trim() || `${connectorId} — recurring scan`,
    connectionValues: record.connectionValues,
    scopeValues: record.scopeValues ?? {},
    intervalMinutes,
    savedConnectionId: record.savedConnectionId,
  });

  return NextResponse.json({ schedule: toPublicSchedule(schedule) }, { status: 201 });
}
