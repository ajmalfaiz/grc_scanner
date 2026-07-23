"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { EyeOff, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ApprovalBadge,
  ConfidenceBadge,
} from "@/components/ui/status-badges";
import { formatBytes } from "@/lib/utils";

type Event = {
  id: string;
  occurredAt: Date;
  bytesSent: number;
};

type Detail = {
  id: string;
  deviceName: string;
  employeeId: string | null;
  department: string | null;
  toolName: string;
  toolVendor: string;
  domain: string;
  approvalStatus: string;
  confidence: string;
  connectionCount: number;
  dataVolumeBytes: number;
  coverageNote: string;
  lastSeen: Date;
  toolId: string;
  events: Event[];
};

export function FindingDetailPanel({
  finding,
  closeHref,
}: {
  finding: Detail;
  closeHref: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(finding.approvalStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateApproval(next: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tools/${finding.toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: next }),
      });
      if (!res.ok) {
        setError("Could not update approval status");
        return;
      }
      setStatus(next);
      router.refresh();
    });
  }

  const maxBytes = Math.max(...finding.events.map((x) => x.bytesSent), 1);

  return (
    <Card className="sticky top-20">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardDescription>Finding detail</CardDescription>
          <CardTitle className="mt-1">{finding.deviceName}</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close detail"
          onClick={() => router.push(closeHref)}
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert className="bg-accent/50">
          <EyeOff />
          <AlertDescription>
            Content not visible — domain and volume only. TLS payloads are not
            decrypted in this monitoring model.
          </AlertDescription>
        </Alert>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Employee</dt>
            <dd className="mt-1 font-medium">{finding.employeeId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Department</dt>
            <dd className="mt-1 font-medium">{finding.department ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Domain contacted</dt>
            <dd className="mt-1 font-mono text-[13px]">{finding.domain}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tool</dt>
            <dd className="mt-1 font-medium">
              {finding.toolName} ({finding.toolVendor})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Confidence</dt>
            <dd className="mt-1">
              <ConfidenceBadge confidence={finding.confidence} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Connections</dt>
            <dd className="mt-1 tabular-nums font-medium">
              {finding.connectionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Data volume</dt>
            <dd className="mt-1 font-medium">
              {formatBytes(finding.dataVolumeBytes)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Coverage</dt>
            <dd className="mt-1 text-muted-foreground">{finding.coverageNote}</dd>
          </div>
        </dl>

        <Separator />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Approval status
            </p>
            <ApprovalBadge status={status} />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Marking a tool approved becomes policy input for later. No
            block/enforce actions in this prototype.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["approved", "unapproved", "under_review"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "default" : "outline"}
                disabled={pending || status === s}
                onClick={() => updateApproval(s)}
                className="capitalize"
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>
          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Connection timeline
          </p>
          <div className="mb-3 flex h-10 items-end gap-0.5">
            {finding.events
              .slice()
              .reverse()
              .map((e) => {
                const h = Math.max(8, Math.round((e.bytesSent / maxBytes) * 40));
                return (
                  <span
                    key={e.id}
                    className="flex-1 rounded-sm bg-primary/80"
                    style={{ height: h }}
                    title={formatBytes(e.bytesSent)}
                  />
                );
              })}
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
            {finding.events.slice(0, 10).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>{format(new Date(e.occurredAt), "dd MMM yyyy HH:mm")}</span>
                <span className="tabular-nums text-foreground">
                  {formatBytes(e.bytesSent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
