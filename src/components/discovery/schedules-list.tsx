"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getScanResult } from "@/lib/discovery-mock-data";
import {
  deleteDiscoverySchedule,
  listDiscoverySchedules,
  runDiscoveryScheduleNow,
  setDiscoveryScheduleEnabled,
  type DiscoverySchedule,
} from "@/lib/discovery-schedule-client";
import {
  getSavedConnection,
  touchSavedConnection,
  type SavedScanResult,
} from "@/lib/saved-connections";

const POLL_MS = 5000;

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function formatInterval(minutes: number): string {
  if (minutes % 1440 === 0) return `Every ${minutes / 1440} day${minutes / 1440 > 1 ? "s" : ""}`;
  if (minutes % 60 === 0) return `Every ${minutes / 60} hour${minutes / 60 > 1 ? "s" : ""}`;
  return `Every ${minutes} minutes`;
}

export function SchedulesList() {
  const [schedules, setSchedules] = useState<DiscoverySchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await listDiscoverySchedules();
      setSchedules(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load schedules");
    }
  }, []);

  useEffect(() => {
    // Deferred via setTimeout(0) rather than called directly: an effect
    // body shouldn't synchronously trigger a setState chain (even through
    // an awaited async call) — see react-hooks/set-state-in-effect.
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function handleToggle(schedule: DiscoverySchedule) {
    setBusyId(schedule.id);
    try {
      await setDiscoveryScheduleEnabled(schedule.id, !schedule.enabled);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update schedule");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRunNow(schedule: DiscoverySchedule) {
    setBusyId(schedule.id);
    try {
      await runDiscoveryScheduleNow(schedule.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start scan");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(schedule: DiscoverySchedule) {
    setBusyId(schedule.id);
    try {
      await deleteDiscoverySchedule(schedule.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete schedule");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApplyToSavedConnection(schedule: DiscoverySchedule) {
    const jobId = schedule.runs.find((r) => r.status === "completed")?.jobId;
    if (!jobId || !schedule.savedConnectionId) return;
    setBusyId(schedule.id);
    setApplyMessage(null);
    try {
      const res = await fetch(`/api/discovery/jobs/${jobId}`);
      const data = (await res.json()) as { result?: SavedScanResult };
      if (!res.ok || !data.result) throw new Error("Latest run result is no longer available");
      const saved = getSavedConnection(schedule.savedConnectionId);
      if (!saved) throw new Error("The saved connection this schedule was created from no longer exists");
      touchSavedConnection(schedule.savedConnectionId, data.result);
      setApplyMessage(`Applied the latest run to "${saved.label}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply result");
    } finally {
      setBusyId(null);
    }
  }

  if (schedules === null) {
    return <p className="text-sm text-muted-foreground">Loading schedules…</p>;
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
          <Clock className="size-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No scheduled scans yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Open a saved connection and click &quot;Schedule&quot; to run it
            automatically on an interval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {applyMessage ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {applyMessage}
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {schedules.map((schedule) => {
          const Icon = getScanResult(schedule.connectorId)?.icon;
          const latestRun = schedule.runs[0];
          const canApply =
            !!schedule.savedConnectionId && schedule.runs.some((r) => r.status === "completed");
          const busy = busyId === schedule.id;

          return (
            <li
              key={schedule.id}
              className="space-y-2 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-2.5">
                {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{schedule.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInterval(schedule.intervalMinutes)} ·{" "}
                    {schedule.enabled ? "enabled" : "disabled"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Next run {schedule.enabled ? formatWhen(schedule.nextRunAt) : "— disabled"}
              </p>
              <p className="text-xs text-muted-foreground">
                Last run {formatWhen(schedule.lastRunAt)}
                {latestRun ? ` · ${latestRun.status}` : ""}
              </p>
              {latestRun?.summary ? (
                <p className="text-xs text-foreground">{latestRun.summary}</p>
              ) : null}
              {latestRun?.error ? (
                <p className="text-xs text-destructive">{latestRun.error}</p>
              ) : null}

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleRunNow(schedule)}>
                  {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
                  Run now
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleToggle(schedule)}>
                  {schedule.enabled ? "Disable" : "Enable"}
                </Button>
                {canApply ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => handleApplyToSavedConnection(schedule)}>
                    Apply to saved connection
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => handleDelete(schedule)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
