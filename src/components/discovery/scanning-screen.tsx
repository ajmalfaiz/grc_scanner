"use client";

import { useEffect, useState } from "react";
import { DatabaseZap } from "lucide-react";

import { cn } from "@/lib/utils";

const SCAN_STATUS_LINES = [
  "Opening a read-only connection to the selected source.",
  "Cataloguing schemas, tables, columns, and data types.",
  "Running metadata triage on names and structural context.",
  "Sampling selected fields without storing raw cell values.",
  "Running local PII detectors and checksum validators.",
  "Calculating match rates, confidence, and coverage gaps.",
  "Preparing structured findings and scan evidence.",
];

export function ScanningScreen({
  connectorName,
  className,
}: {
  connectorName: string;
  className?: string;
}) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % SCAN_STATUS_LINES.length);
    }, 1400);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center",
        className,
      )}
    >
      <div className="relative flex size-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-primary/20" />
        <div className="absolute inset-2 animate-ping rounded-full border border-primary/20" />
        <div className="absolute inset-3 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div className="relative flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <DatabaseZap className="size-6" aria-hidden />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Scanning {connectorName}
        </h2>
        <p className="text-sm text-muted-foreground">
          This can take a moment on larger sources.
        </p>
      </div>

      <p className="mt-5 min-h-5 text-sm font-medium text-foreground">
        {SCAN_STATUS_LINES[statusIndex]}
      </p>
    </div>
  );
}

