import type { ConnectorId, ConnectorScanResult } from "@/lib/discovery-mock-data";
import { getConnector } from "@/lib/discovery/registry";

/**
 * In-memory background job runner for scans — no database, no queue
 * infrastructure. A scan starts immediately in the background; the caller
 * gets a job id back right away and polls for status.
 *
 * Caveats (see docs/GAPS-AND-NEXT-STEPS.md):
 * - State lives in process memory only — a server restart loses all jobs.
 * - On serverless platforms, the process may be frozen/killed once the
 *   HTTP response is sent, so background work is only reliable on a
 *   persistent Node process (e.g. `next start`, a container, a VM) — not
 *   on function-per-request serverless hosting without a keep-alive hook.
 * - This is a stand-in for a real queue (BullMQ, a DB-backed outbox, …)
 *   that a multi-user / production deployment would need instead.
 */

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Job = {
  id: string;
  connectorId: ConnectorId;
  label?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ConnectorScanResult;
  error?: string;
};

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes after completion
const MAX_JOBS = 200;

const jobs = new Map<string, Job>();

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function pruneOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.completedAt && now - Date.parse(job.completedAt) > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
  if (jobs.size > MAX_JOBS) {
    const sorted = [...jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const job of sorted.slice(0, jobs.size - MAX_JOBS)) {
      jobs.delete(job.id);
    }
  }
}

/** Start a scan job for a connector. Returns immediately with a queued job. */
export function startScanJob(input: {
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  label?: string;
}): Job {
  pruneOldJobs();

  const job: Job = {
    id: newId(),
    connectorId: input.connectorId,
    label: input.label,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);

  // Fire and forget — the caller polls getJob() for progress.
  void runJob(job, input.connectionValues, input.scopeValues);

  return job;
}

async function runJob(
  job: Job,
  connectionValues: Record<string, string>,
  scopeValues: Record<string, string>,
) {
  job.status = "running";
  job.startedAt = new Date().toISOString();

  try {
    const connector = getConnector(job.connectorId);
    const result = await connector.scan(connectionValues, scopeValues);
    job.result = result;
    job.status = "completed";
  } catch (error) {
    job.error = error instanceof Error ? error.message : "Scan failed";
    job.status = "failed";
  } finally {
    job.completedAt = new Date().toISOString();
  }
}

export function getJob(id: string): Job | undefined {
  pruneOldJobs();
  return jobs.get(id);
}

export function listJobs(): Job[] {
  pruneOldJobs();
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Test-only: clear all jobs and reset state between test runs. */
export function resetJobStoreForTests() {
  jobs.clear();
}
