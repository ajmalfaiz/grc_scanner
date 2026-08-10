"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createDiscoverySchedule } from "@/lib/discovery-schedule-client";
import type { ConnectorId } from "@/lib/discovery-mock-data";

const INTERVAL_PRESETS = [
  { label: "Every hour", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Daily", minutes: 1440 },
  { label: "Weekly", minutes: 10080 },
];

export function ScheduleScanSheet({
  open,
  onOpenChange,
  connectorId,
  label,
  connectionValues,
  scopeValues,
  savedConnectionId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectorId: ConnectorId;
  label: string;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  savedConnectionId: string;
  onCreated?: () => void;
}) {
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await createDiscoverySchedule({
        connectorId,
        label,
        connectionValues,
        scopeValues,
        intervalMinutes,
        savedConnectionId,
      });
      setDone(true);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDone(false);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Schedule recurring scans</SheetTitle>
          <SheetDescription>
            Runs this connection&apos;s scan automatically on an interval,
            in the background — no need to keep this tab open. Credentials
            are held in server memory for as long as the schedule exists
            (there is no database in this build; see the gaps doc).
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {done ? (
            <p className="text-sm text-foreground">
              Schedule created. Manage it from{" "}
              <a href="/discovery/schedules" className="underline">
                Scheduled scans
              </a>
              .
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Run every
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {INTERVAL_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => setIntervalMinutes(preset.minutes)}
                      className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        intervalMinutes === preset.minutes
                          ? "border-foreground/30 bg-muted/60 font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-interval" className="text-xs font-medium text-foreground">
                  Or custom (minutes)
                </Label>
                <Input
                  id="custom-interval"
                  type="number"
                  min={5}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value) || 5)}
                />
              </div>
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done ? (
            <Button type="button" disabled={submitting || intervalMinutes < 5} onClick={handleCreate}>
              {submitting ? "Creating…" : "Create schedule"}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
