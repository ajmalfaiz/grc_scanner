import type { ConnectorId } from "@/lib/discovery-mock-data";

export type ScheduleRun = {
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: "queued" | "running" | "completed" | "failed";
  summary?: string;
  error?: string;
};

export type DiscoverySchedule = {
  id: string;
  connectorId: ConnectorId;
  label: string;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  savedConnectionId?: string;
  runs: ScheduleRun[];
};

async function parseOrThrow(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : fallback);
  }
  return data;
}

export async function listDiscoverySchedules(): Promise<DiscoverySchedule[]> {
  const res = await fetch("/api/discovery/schedules");
  const data = await parseOrThrow(res, "Could not load schedules");
  return Array.isArray(data.schedules) ? (data.schedules as DiscoverySchedule[]) : [];
}

export async function createDiscoverySchedule(input: {
  connectorId: ConnectorId;
  label: string;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  intervalMinutes: number;
  savedConnectionId?: string;
}): Promise<DiscoverySchedule> {
  const res = await fetch("/api/discovery/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseOrThrow(res, "Could not create schedule");
  return data.schedule as DiscoverySchedule;
}

export async function setDiscoveryScheduleEnabled(id: string, enabled: boolean): Promise<DiscoverySchedule> {
  const res = await fetch(`/api/discovery/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const data = await parseOrThrow(res, "Could not update schedule");
  return data.schedule as DiscoverySchedule;
}

export async function runDiscoveryScheduleNow(id: string): Promise<{ jobId: string }> {
  const res = await fetch(`/api/discovery/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runNow: true }),
  });
  const data = await parseOrThrow(res, "Could not start scan");
  return { jobId: data.jobId as string };
}

export async function deleteDiscoverySchedule(id: string): Promise<void> {
  const res = await fetch(`/api/discovery/schedules/${id}`, { method: "DELETE" });
  await parseOrThrow(res, "Could not delete schedule");
}
