"use client";

import {
  useCallback,
  useMemo,
  useState,
  type UIEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  countNeedsReview,
  detectionMethodLabels,
  type ConnectorScanResult,
  type CoverageIssue,
  type DetectionMethod,
  type DetectionSignal,
  type Finding,
} from "@/lib/discovery-mock-data";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 44;
const OVERSCAN_ROWS = 6;
const DEFAULT_VIEWPORT_HEIGHT = 320;

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString("en-IN");
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border font-normal capitalize",
        confidence === "high"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {confidence}
    </Badge>
  );
}

const detectionMethodDescriptions: Record<DetectionMethod, string> = {
  name_triage:
    "Metadata-only detection. The scanner matched the field or column name, surrounding schema/table context, or LLM metadata triage to a known PII type.",
  content_sample:
    "Content-sample detection. The scanner sampled values from this field and matched local PII detectors such as patterns, checksums, or statistical profiles.",
  both: "Name + content detection. The metadata looked like PII and sampled values also matched a local detector, so this is stronger than either signal alone.",
};

const detectionSignalLabels: Record<DetectionSignal, string> = {
  metadata_name: "Field/column name",
  metadata_context: "Schema/table context",
  value_pattern: "Value pattern",
  checksum: "Checksum validator",
  statistical_profile: "Statistical profile",
};

function formatEvidenceCount(
  matched: number | undefined,
  sampled: number | undefined,
): string | null {
  if (matched === undefined || sampled === undefined) return null;
  return `${formatCount(matched)} of ${formatCount(sampled)} sampled records matched`;
}

function MethodBadge({ finding }: { finding: Finding }) {
  const method = finding.detectedVia;
  const evidence = finding.evidence;
  const evidenceCount = formatEvidenceCount(
    evidence?.matchedRecords,
    evidence?.sampledRecords,
  );
  const signals = finding.detectionSignals ?? [];

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex h-5 w-fit items-center justify-center rounded-md border border-border px-2 py-0.5 text-xs font-normal text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Detected via ${detectionMethodLabels[method]}. Hover or focus for details.`}
      >
        {detectionMethodLabels[method]}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="block w-[min(36rem,calc(100vw-2rem))] max-w-none border border-border bg-popover p-3 text-left text-popover-foreground shadow-lg"
      >
        <div className="space-y-2">
          <div>
            <p className="font-medium">{detectionMethodLabels[method]}</p>
            <p className="mt-1 leading-snug text-muted-foreground">
              {detectionMethodDescriptions[method]}
            </p>
          </div>

          <div className="rounded-md bg-muted/60 p-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              What was found
            </p>
            <p className="mt-1 leading-snug">
              {finding.piiType} at{" "}
              <span className="font-mono text-[11px]">{finding.location}</span>
              .
            </p>
          </div>

          {signals.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Signals
              </p>
              <p className="mt-1 leading-snug">
                {signals.map((signal) => detectionSignalLabels[signal]).join(", ")}
              </p>
            </div>
          ) : null}

          {evidenceCount || evidence?.matchRate !== undefined ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sample evidence
              </p>
              <p className="mt-1 leading-snug">
                {evidenceCount ?? "Sample match count was not recorded"}
                {evidence?.matchRate !== undefined
                  ? ` (${formatPercent(evidence.matchRate)})`
                  : ""}
                . Raw values were not stored.
              </p>
            </div>
          ) : null}

          {evidence?.validators.length ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Validators
              </p>
              <p className="mt-1 leading-snug">
                {evidence.validators.join(", ")}
              </p>
            </div>
          ) : null}

          {evidence?.reasons.length ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Why
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 leading-snug">
                {evidence.reasons.slice(0, 4).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function CoverageQualityCard({
  quality,
}: {
  quality: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">Coverage quality</p>
      <p className="mt-0.5 text-xl font-medium tracking-tight text-foreground">
        {quality}
      </p>
    </div>
  );
}

function CoverageStatusBadge({ status }: { status: CoverageIssue["status"] }) {
  return (
    <Badge variant="outline" className="rounded-md border font-normal">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function CoverageDetailSheet({
  result,
  open,
  onOpenChange,
}: {
  result: ConnectorScanResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const issues = result.coverageIssues ?? [];
  const coverageQuality =
    result.coverage && result.coverage.assetsDiscovered > 0
      ? result.coverage.assetsScanned / result.coverage.assetsDiscovered
      : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-3/4 max-w-none flex-col gap-0 p-0 sm:max-w-none"
        style={{ width: "75vw", maxWidth: "75vw" }}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Coverage gaps</SheetTitle>
          <SheetDescription>
            Structured scan coverage for {result.name}. Raw sampled values are
            not stored.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Coverage quality"
              value={formatPercent(coverageQuality)}
            />
            <StatCard label="Coverage gaps" value={issues.length} />
            <StatCard
              label="Assets scanned"
              value={result.coverage?.assetsScanned ?? 0}
            />
            <StatCard
              label="Assets partial"
              value={result.coverage?.assetsPartial ?? 0}
            />
            <StatCard
              label="Assets skipped"
              value={result.coverage?.assetsSkipped ?? 0}
            />
            <StatCard
              label="Assets capped"
              value={result.coverage?.assetsCapped ?? 0}
            />
          </div>

          <div className="mt-4 rounded-lg border border-border">
            {issues.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Sampled</TableHead>
                    <TableHead className="text-right">Estimated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue, index) => (
                    <TableRow key={`${issue.asset}-${issue.status}-${index}`}>
                      <TableCell className="max-w-56 whitespace-normal font-mono text-xs">
                        {issue.asset}
                      </TableCell>
                      <TableCell>
                        <CoverageStatusBadge status={issue.status} />
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                        {issue.reason}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(issue.sampledRecords)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(issue.estimatedRecords)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                No structured coverage gaps were reported for this scan.
              </div>
            )}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {result.coverageLine}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FindingRow({
  finding,
  index,
  loading,
}: {
  finding?: Finding;
  index: number;
  loading: boolean;
}) {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      className="absolute inset-x-0 grid h-11 grid-cols-[4rem_minmax(14rem,1.5fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)] items-center border-b border-border text-sm"
      style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
    >
      {finding ? (
        <>
          <div
            role="cell"
            className="px-3 text-xs tabular-nums text-muted-foreground"
          >
            {index + 1}
          </div>
          <div
            role="cell"
            className="truncate px-3 font-mono text-xs text-foreground"
          >
            {finding.location}
          </div>
          <div role="cell" className="truncate px-3 text-foreground">
            {finding.piiType}
          </div>
          <div role="cell" className="px-3">
            <MethodBadge finding={finding} />
          </div>
          <div role="cell" className="px-3">
            <ConfidenceBadge confidence={finding.confidence} />
          </div>
          <div
            role="cell"
            className="px-3 text-xs tabular-nums text-muted-foreground"
            title={finding.evidence?.reasons.join("; ")}
          >
            {finding.evidence?.matchedRecords !== undefined &&
            finding.evidence?.sampledRecords !== undefined
              ? `${finding.evidence.matchedRecords}/${finding.evidence.sampledRecords}`
              : formatPercent(finding.evidence?.matchRate)}
          </div>
        </>
      ) : (
        <div
          role="cell"
          aria-colspan={6}
          className="col-span-6 px-3 text-xs text-muted-foreground"
        >
          {loading ? "Loading findings..." : "Finding unavailable"}
        </div>
      )}
    </div>
  );
}

function VirtualizedFindingsTable({
  result,
}: {
  result: ConnectorScanResult;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    DEFAULT_VIEWPORT_HEIGHT,
  );
  const total = result.findings.length;

  const visibleStart = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const visibleEnd = Math.min(
    Math.max(total - 1, 0),
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );

  const visibleRows = useMemo(() => {
    if (total === 0) return [];

    return Array.from(
      { length: visibleEnd - visibleStart + 1 },
      (_, offset) => {
        const index = visibleStart + offset;
        return {
          index,
          finding: result.findings[index],
          loading: false,
        };
      },
    );
  }, [result.findings, total, visibleEnd, visibleStart]);

  const setScrollNode = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setViewportHeight(node.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
    }
  }, []);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    setViewportHeight(
      event.currentTarget.clientHeight || DEFAULT_VIEWPORT_HEIGHT,
    );
    setScrollTop(event.currentTarget.scrollTop);
  }

  return (
    <div
      ref={setScrollNode}
      role="table"
      aria-label={`${result.name} findings`}
      aria-rowcount={total + 1}
      className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card"
      onScroll={handleScroll}
    >
      <div className="min-w-[900px]">
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-10 grid h-9 grid-cols-[4rem_minmax(14rem,1.5fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)_minmax(7rem,0.45fr)_minmax(7rem,0.45fr)] items-center border-b border-border bg-card text-xs font-medium text-foreground shadow-[0_1px_0_var(--border)]"
        >
          <div role="columnheader" className="px-3">
            Sl no.
          </div>
          <div role="columnheader" className="px-3">
            Location
          </div>
          <div role="columnheader" className="px-3">
            PII type detected
          </div>
          <div role="columnheader" className="px-3">
            Detected via
          </div>
          <div role="columnheader" className="px-3">
            Confidence
          </div>
          <div role="columnheader" className="px-3">
            Matches
          </div>
        </div>

        <div
          role="rowgroup"
          className="relative"
          style={{ height: `${Math.max(total, 1) * ROW_HEIGHT}px` }}
        >
          {visibleRows.length > 0 ? (
            visibleRows.map((row) => (
              <FindingRow
                key={row.index}
                index={row.index}
                finding={row.finding}
                loading={row.loading}
              />
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No findings detected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScanFindings({ result }: { result: ConnectorScanResult }) {
  const [coverageOpen, setCoverageOpen] = useState(false);
  const findingsCount = result.findings.length;
  const needsReview = countNeedsReview(result.findings);
  const coverageGapCount = result.coverageIssues?.length ?? 0;
  const coverageQuality =
    result.coverage && result.coverage.assetsDiscovered > 0
      ? result.coverage.assetsScanned / result.coverage.assetsDiscovered
      : undefined;

  return (
    <>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label={result.scopeLabel} value={result.scopeValue} />
        <StatCard label="Findings" value={findingsCount} />
        <StatCard label="Needs review" value={needsReview} />
        <CoverageQualityCard
          quality={formatPercent(coverageQuality)}
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Findings</h2>
          <button
            type="button"
            onClick={() => setCoverageOpen(true)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View coverage gaps ({coverageGapCount})
          </button>
        </div>
        <VirtualizedFindingsTable result={result} />
      </section>

      <p className="shrink-0 border-t border-border pt-3 text-sm text-muted-foreground">
        {result.coverageLine}
      </p>
      <CoverageDetailSheet
        result={result}
        open={coverageOpen}
        onOpenChange={setCoverageOpen}
      />
    </>
  );
}
