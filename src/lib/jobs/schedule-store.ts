import type { ConnectorId } from "@/lib/discovery-mock-data";
import { getJob, startScanJob, type Job } from "@/lib/jobs/job-store";
import { SECRET_FIELD_NAMES } from "@/lib/saved-connections";

/**
 * In-memory recurring-scan scheduler — no database. A schedule holds a
 * connection + scope (including credentials, since there is nowhere else
 * to keep them between runs without a database/auth layer) and triggers a
 * background scan job on an interval, entirely in this process's memory.
 *
 * Caveats (see docs/GAPS-AND-NEXT-STEPS.md):
 * - Everything is lost on server restart — schedules, history, all of it.
 * - Credentials for a schedule are held in plaintext in server memory for
 *   as long as the schedule exists — a materially different (and larger)
 *   exposure than the browser-only localStorage model the rest of this app
 *   uses. This is an explicit, documented trade-off of running scheduling
 *   without a database/auth layer, not an oversight.
 * - The ticker only fires while this Node process is alive; on serverless
 *   hosting without a persistent process it will not run reliably.
 */

export type ScheduleRun = {
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: Job["status"];
  summary?: string;
  error?: string;
};

export type Schedule = {
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
  /** Saved connection this schedule was created from, if any — lets the UI
   *  offer "apply this run's findings back to that saved connection". */
  savedConnectionId?: string;
  /** Most recent runs first, capped. */
  runs: ScheduleRun[];
};

const MAX_RUN_HISTORY = 10;
const MIN_INTERVAL_MINUTES = 5;
const TICK_MS = 30_000;

const schedules = new Map<string, Schedule>();

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function redactScheduleConnection(values: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = SECRET_FIELD_NAMES.has(key) ? "" : value;
  }
  return next;
}

/** Public view of a schedule — never includes raw credentials. */
export function toPublicSchedule(schedule: Schedule) {
  return {
    ...schedule,
    connectionValues: redactScheduleConnection(schedule.connectionValues),
  };
}

export function createSchedule(input: {
  connectorId: ConnectorId;
  label: string;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  intervalMinutes: number;
  savedConnectionId?: string;
}): Schedule {
  const intervalMinutes = Math.max(MIN_INTERVAL_MINUTES, Math.round(input.intervalMinutes));
  const now = new Date();
  const schedule: Schedule = {
    id: newId(),
    connectorId: input.connectorId,
    label: input.label,
    connectionValues: input.connectionValues,
    scopeValues: input.scopeValues,
    intervalMinutes,
    enabled: true,
    createdAt: now.toISOString(),
    nextRunAt: new Date(now.getTime() + intervalMinutes * 60_000).toISOString(),
    savedConnectionId: input.savedConnectionId,
    runs: [],
  };
  schedules.set(schedule.id, schedule);
  return schedule;
}

export function listSchedules(): Schedule[] {
  return [...schedules.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getSchedule(id: string): Schedule | undefined {
  return schedules.get(id);
}

export function deleteSchedule(id: string): boolean {
  return schedules.delete(id);
}

export function setScheduleEnabled(id: string, enabled: boolean): Schedule | undefined {
  const schedule = schedules.get(id);
  if (!schedule) return undefined;
  schedule.enabled = enabled;
  if (enabled) {
    schedule.nextRunAt = new Date(Date.now() + schedule.intervalMinutes * 60_000).toISOString();
  }
  return schedule;
}

function recordRunStart(schedule: Schedule, job: Job) {
  const run: ScheduleRun = { jobId: job.id, startedAt: job.createdAt, status: job.status };
  schedule.runs.unshift(run);
  schedule.runs = schedule.runs.slice(0, MAX_RUN_HISTORY);
  schedule.lastRunAt = job.createdAt;
}

function summarizeResult(job: Job): string | undefined {
  const result = job.result;
  if (!result) return undefined;
  return `${result.findings.length} finding(s) — ${result.coverageLine}`;
}

async function pollUntilDone(jobId: string): Promise<Job | undefined> {
  for (let i = 0; i < 600; i += 1) {
    const job = getJob(jobId);
    if (!job) return undefined;
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return getJob(jobId);
}

function runSchedule(schedule: Schedule) {
  const job = startScanJob({
    connectorId: schedule.connectorId,
    connectionValues: schedule.connectionValues,
    scopeValues: schedule.scopeValues,
    label: schedule.label,
  });
  recordRunStart(schedule, job);

  void pollUntilDone(job.id).then((finished) => {
    const run = schedule.runs.find((r) => r.jobId === job.id);
    if (!run || !finished) return;
    run.status = finished.status;
    run.completedAt = finished.completedAt;
    run.summary = summarizeResult(finished);
    run.error = finished.error;
  });
}

/** Manually trigger a schedule to run right now, independent of its timer. */
export function runScheduleNow(id: string): Job | undefined {
  const schedule = schedules.get(id);
  if (!schedule) return undefined;
  const job = startScanJob({
    connectorId: schedule.connectorId,
    connectionValues: schedule.connectionValues,
    scopeValues: schedule.scopeValues,
    label: schedule.label,
  });
  recordRunStart(schedule, job);
  void pollUntilDone(job.id).then((finished) => {
    const run = schedule.runs.find((r) => r.jobId === job.id);
    if (!run || !finished) return;
    run.status = finished.status;
    run.completedAt = finished.completedAt;
    run.summary = summarizeResult(finished);
    run.error = finished.error;
  });
  return job;
}

function tick() {
  const now = Date.now();
  for (const schedule of schedules.values()) {
    if (!schedule.enabled) continue;
    if (Date.parse(schedule.nextRunAt) > now) continue;
    schedule.nextRunAt = new Date(now + schedule.intervalMinutes * 60_000).toISOString();
    runSchedule(schedule);
  }
}

type GlobalWithScheduler = typeof globalThis & { __discoveryScheduler?: ReturnType<typeof setInterval> };
const g = globalThis as GlobalWithScheduler;

/** Idempotent — safe to call from multiple modules/route handlers. */
export function ensureSchedulerRunning() {
  if (g.__discoveryScheduler) return;
  g.__discoveryScheduler = setInterval(tick, TICK_MS);
  if (typeof g.__discoveryScheduler.unref === "function") {
    g.__discoveryScheduler.unref();
  }
}

/** Test-only: clear all schedules and stop the ticker. */
export function resetScheduleStoreForTests() {
  schedules.clear();
  if (g.__discoveryScheduler) {
    clearInterval(g.__discoveryScheduler);
    g.__discoveryScheduler = undefined;
  }
}
