"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { DiscoveryFieldControl } from "@/components/discovery/discovery-field-control";
import { ScanningScreen } from "@/components/discovery/scanning-screen";
import { Button } from "@/components/ui/button";
import { runDiscoveryScanJob } from "@/lib/discovery-scan-client";
import { supportsLiveDiscovery } from "@/lib/discovery/live";
import {
  buildScopeInitialValues,
  coverageModeOptions,
  getVisibleScopeFields,
  isScopeReady,
  type CoverageMode,
} from "@/lib/discovery-scan-scope";
import {
  getScanResult,
  type ConnectorId,
} from "@/lib/discovery-mock-data";
import {
  clearDiscoveryDraft,
  getSavedConnection,
  loadDiscoveryDraft,
  upsertSavedConnection,
} from "@/lib/saved-connections";
import { cn } from "@/lib/utils";

function initialScopeState(connectorId: ConnectorId, savedId?: string) {
  const base = buildScopeInitialValues(connectorId);

  if (savedId) {
    const saved = getSavedConnection(savedId);
    if (saved && saved.connectorId === connectorId) {
      return {
        values: { ...base, ...saved.scopeValues },
        connectionValues: saved.connectionValues,
        activeSavedId: saved.id as string | undefined,
      };
    }
  }

  const draft = loadDiscoveryDraft();
  if (draft && draft.connectorId === connectorId) {
    return {
      values: draft.scopeValues ? { ...base, ...draft.scopeValues } : base,
      connectionValues: draft.connectionValues,
      activeSavedId: draft.savedId,
    };
  }

  return {
    values: base,
    connectionValues: {} as Record<string, string>,
    activeSavedId: savedId,
  };
}

export function ScanScopeForm({
  connectorId,
  savedId,
}: {
  connectorId: ConnectorId;
  savedId?: string;
}) {
  const router = useRouter();
  const result = getScanResult(connectorId);
  const initial = useMemo(
    () => initialScopeState(connectorId, savedId),
    [connectorId, savedId],
  );
  const [values, setValues] = useState(initial.values);
  const [activeSavedId] = useState(initial.activeSavedId);
  const [connectionValues] = useState(initial.connectionValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => getVisibleScopeFields(connectorId, values),
    [connectorId, values],
  );
  const canSubmit = isScopeReady(connectorId, values) && !submitting;
  const coverageMode = (values.coverageMode ?? "sample") as CoverageMode;

  if (!result) return null;

  const Icon = result.icon;

  if (submitting) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3">
        <ScanningScreen connectorName={result.name} />
      </div>
    );
  }

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const draft = loadDiscoveryDraft();
    const nextConnectionValues =
      Object.keys(connectionValues).length > 0
        ? connectionValues
        : (draft?.connectionValues ?? {});
    const storeSecrets = draft?.storeSecrets === true;

    setSubmitting(true);
    setError(null);

    try {
      let lastScanResult = undefined;

      if (supportsLiveDiscovery(connectorId)) {
        // Runs as a background job server-side — not bound by a single HTTP
        // request's timeout, so large/slow sources can complete normally.
        lastScanResult = await runDiscoveryScanJob({
          connectorId,
          connectionValues: nextConnectionValues,
          scopeValues: values,
        });
      }

      const saved = upsertSavedConnection({
        id: activeSavedId ?? draft?.savedId,
        connectorId,
        connectionValues: nextConnectionValues,
        scopeValues: values,
        storeSecrets,
        lastScanResult,
      });

      clearDiscoveryDraft();
      router.push(`/discovery/saved/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <header className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Step 3 of 4</p>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="size-4 text-foreground" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                What to scan
              </h1>
              <p className="text-xs text-muted-foreground">
                Set intensity and sampling for {result.name}. The scan always
                catalogues first, then triages names, then samples content —
                without storing raw values.
              </p>
            </div>
          </div>
        </header>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={submitting}
          nativeButton={false}
          render={
            <Link
              href={
                activeSavedId
                  ? `/discovery/connect/${connectorId}?saved=${activeSavedId}`
                  : `/discovery/connect/${connectorId}`
              }
            />
          }
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 pr-1">
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {coverageModeOptions.map((option) => {
              const selected = coverageMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={submitting}
                  onClick={() => setValue("coverageMode", option.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "border-border bg-card hover:border-foreground/25",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 content-start gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {visible.map((field) => (
              <DiscoveryFieldControl
                key={field.name}
                field={field}
                value={values[field.name] ?? ""}
                onChange={(next) => setValue(field.name, next)}
                idPrefix="scope"
              />
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-end border-t border-border pt-3">
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="min-w-44"
        >
          {submitting ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              Run scan & save
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
