"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ApprovalBadge,
  ConfidenceBadge,
} from "@/components/ui/status-badges";
import { EmptyState } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatBytes } from "@/lib/utils";

export type FindingRow = {
  id: string;
  deviceName: string;
  employeeId: string | null;
  toolName: string;
  toolVendor: string;
  domain: string;
  connectionCount: number;
  dataVolumeBytes: number;
  approvalStatus: string;
  confidence: string;
  lastSeen: Date;
};

export function FindingsTable({
  findings,
  selectedId,
  baseQuery,
}: {
  findings: FindingRow[];
  selectedId?: string;
  baseQuery: string;
}) {
  if (findings.length === 0) {
    return <EmptyState message="No findings match the current filters." />;
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Device / user</TableHead>
            <TableHead>AI tool</TableHead>
            <TableHead>Connections</TableHead>
            <TableHead>Data volume</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((f) => {
            const href = baseQuery
              ? `/findings?${baseQuery}&id=${f.id}`
              : `/findings?id=${f.id}`;
            const selected = selectedId === f.id;
            return (
              <TableRow
                key={f.id}
                className={cn(
                  "cursor-pointer",
                  selected && "bg-accent/60 hover:bg-accent/60",
                )}
              >
                <TableCell className="p-0" colSpan={7}>
                  <Link
                    href={href}
                    className="grid grid-cols-[1.3fr_1.3fr_0.7fr_0.9fr_1fr_0.85fr_1.1fr] items-center"
                  >
                    <span className="px-2 py-3">
                      <span className="block font-medium">{f.deviceName}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.employeeId ?? "—"}
                      </span>
                    </span>
                    <span className="px-2 py-3">
                      <span className="block font-medium">
                        {f.toolName}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({f.toolVendor})
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {f.domain}
                      </span>
                    </span>
                    <span className="px-2 py-3 tabular-nums">
                      {f.connectionCount}
                    </span>
                    <span className="px-2 py-3 tabular-nums">
                      {formatBytes(f.dataVolumeBytes)}
                    </span>
                    <span className="px-2 py-3">
                      <ApprovalBadge status={f.approvalStatus} />
                    </span>
                    <span className="px-2 py-3">
                      <ConfidenceBadge confidence={f.confidence} />
                    </span>
                    <span className="px-2 py-3 text-muted-foreground">
                      {format(new Date(f.lastSeen), "dd MMM yyyy HH:mm")}
                    </span>
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
