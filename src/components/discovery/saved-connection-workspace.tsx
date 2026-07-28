"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

import { EditConnectionSheet } from "@/components/discovery/edit-connection-sheet";
import { EditScopeSheet } from "@/components/discovery/edit-scope-sheet";
import { RescanCredentialsSheet } from "@/components/discovery/rescan-credentials-sheet";
import { ScanFindings } from "@/components/discovery/scan-findings";
import { ScanningScreen } from "@/components/discovery/scanning-screen";
import { Button } from "@/components/ui/button";
import { runDiscoveryScan } from "@/lib/discovery-scan-client";
import { supportsLiveDiscovery } from "@/lib/discovery/live";
import {
  getScanResult,
  type ConnectorScanResult,
} from "@/lib/discovery-mock-data";
import {
  formatScannedAt,
  getSavedConnectionsSnapshot,
  hasUsableStoredSecrets,
  subscribeSavedConnections,
  touchSavedConnection,
  type SavedConnection,
  type SavedScanResult,
} from "@/lib/saved-connections";

const EMPTY: SavedConnection[] = [];

export type SavedEditPanel = "connection" | "scope" | "credentials" | null;

function toDisplayResult(
  saved: SavedConnection,
): ConnectorScanResult | null {
  const meta = getScanResult(saved.connectorId);
  if (!meta) return null;

  const cached = saved.lastScanResult;
  if (cached) {
    return {
      ...meta,
      scanRun: cached.scanRun,
      scopeLabel: cached.scopeLabel,
      scopeValue: cached.scopeValue,
      findings: cached.findings,
      coverage: cached.coverage,
      coverageIssues: cached.coverageIssues,
      coverageLine: cached.coverageLine,
      methodNote: cached.methodNote,
    };
  }

  // Non-postgres connectors still use mock findings until wired.
  if (saved.connectorId !== "postgres") {
    return meta;
  }

  return {
    ...meta,
    scopeValue: 0,
    findings: [],
    coverageLine: "No scan results yet — run a scan to discover PII.",
    methodNote:
      "Connect with valid credentials and run a scan. Findings are types and locations only.",
  };
}

export function SavedConnectionWorkspace({
  id,
  initialPanel = null,
}: {
  id: string;
  initialPanel?: SavedEditPanel;
}) {
  const router = useRouter();
  const connections = useSyncExternalStore(
    subscribeSavedConnections,
    getSavedConnectionsSnapshot,
    () => EMPTY,
  );

  const saved = useMemo(
    () => connections.find((item) => item.id === id) ?? null,
    [connections, id],
  );

  const [panel, setPanel] = useState<SavedEditPanel>(initialPanel);
  const [rescanFlash, setRescanFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  if (!saved) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Connection not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This saved connection is missing or was removed from this browser.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/discovery/saved" />}>
          Back to Saved connections
        </Button>
      </div>
    );
  }

  const result = toDisplayResult(saved);
  if (!result) {
    return null;
  }

  const Icon = result.icon;

  function showRescanFlash() {
    setRescanFlash(true);
    window.setTimeout(() => setRescanFlash(false), 2500);
  }

  async function runLiveRescan(
    connection: SavedConnection,
    connectionValues: Record<string, string>,
  ): Promise<SavedScanResult> {
    return runDiscoveryScan({
      connectorId: connection.connectorId,
      connectionValues,
      scopeValues: connection.scopeValues,
    });
  }

  async function finishRescan(
    connection: SavedConnection,
    connectionValues?: Record<string, string>,
  ) {
    setScanning(true);
    setScanError(null);

    try {
      if (supportsLiveDiscovery(connection.connectorId)) {
        const values = connectionValues ?? connection.connectionValues;
        const lastScanResult = await runLiveRescan(connection, values);
        touchSavedConnection(connection.id, lastScanResult);
      } else {
        touchSavedConnection(connection.id);
      }
      showRescanFlash();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function requestRescan() {
    if (supportsLiveDiscovery(saved!.connectorId)) {
      if (hasUsableStoredSecrets(saved!)) {
        void finishRescan(saved!);
        return;
      }
      setPanel("credentials");
      return;
    }

    void finishRescan(saved!);
  }

  function clearPanel() {
    setPanel(null);
    router.replace(`/discovery/saved/${id}`);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <header className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="size-4 text-foreground" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-xl font-semibold tracking-tight text-foreground">
                {saved.label}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {saved.connectionSummary} · {saved.scopeSummary} · Last scan{" "}
                {formatScannedAt(saved.lastScannedAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasUsableStoredSecrets(saved)
                  ? "Password / keys remembered in this browser."
                  : "Password / keys not saved — required on each rescan."}
              </p>
            </div>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/discovery/saved" />}
          >
            <ArrowLeft data-icon="inline-start" />
            Saved connections
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={scanning}
            onClick={() => setPanel("connection")}
          >
            <Settings2 data-icon="inline-start" />
            Edit connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={scanning}
            onClick={() => setPanel("scope")}
          >
            <SlidersHorizontal data-icon="inline-start" />
            What to scan
          </Button>
          <Button size="sm" disabled={scanning} onClick={requestRescan}>
            {scanning ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            {scanning ? "Scanning…" : "Rescan"}
          </Button>
        </div>
      </div>

      {rescanFlash ? (
        <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          Scan refreshed with the current connection and scope settings.
        </div>
      ) : null}

      {scanError ? (
        <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {scanError}
        </div>
      ) : null}

      <p className="shrink-0 text-xs text-muted-foreground">
        {result.methodNote}
      </p>

      {scanning ? (
        <ScanningScreen connectorName={result.name} />
      ) : (
        <ScanFindings result={result} />
      )}

      <EditConnectionSheet
        open={panel === "connection"}
        onOpenChange={(open) => {
          if (open) setPanel("connection");
          else clearPanel();
        }}
        saved={saved}
        onSaved={(next, wantRescan, scanConnectionValues) => {
          if (!wantRescan) return;
          if (supportsLiveDiscovery(next.connectorId)) {
            void finishRescan(
              next,
              scanConnectionValues ?? next.connectionValues,
            );
            return;
          }
          showRescanFlash();
        }}
      />

      <EditScopeSheet
        open={panel === "scope"}
        onOpenChange={(open) => {
          if (open) setPanel("scope");
          else clearPanel();
        }}
        saved={saved}
        onSaved={(_next, wantRescan) => {
          if (wantRescan) requestRescan();
        }}
      />

      <RescanCredentialsSheet
        open={panel === "credentials"}
        onOpenChange={(open) => {
          if (open) setPanel("credentials");
          else clearPanel();
        }}
        saved={saved}
        onRescanned={(next, connectionValues) => {
          void finishRescan(next, connectionValues);
        }}
      />
    </div>
  );
}
