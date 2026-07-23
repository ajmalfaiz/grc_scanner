"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ScanFindings } from "@/components/discovery/scan-findings";
import { Button } from "@/components/ui/button";
import { getScanResult, type ConnectorId } from "@/lib/discovery-mock-data";

/** First-run wizard result view (step 4). Saved rescans use SavedConnectionWorkspace. */
export function ScanResultView({ connectorId }: { connectorId: ConnectorId }) {
  const result = getScanResult(connectorId);
  if (!result) return null;

  const Icon = result.icon;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <header className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Step 4 of 4</p>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="size-4 text-foreground" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {result.name} scan result
              </h1>
              <p className="text-xs text-muted-foreground">
                {result.methodNote}
              </p>
            </div>
          </div>
        </header>

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/discovery" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Choose another
        </Button>
      </div>

      <ScanFindings result={result} />
    </div>
  );
}
