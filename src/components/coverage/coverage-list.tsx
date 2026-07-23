import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coverageReasonLabels } from "@/lib/utils";

type Device = {
  id: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  coverageReason: string | null;
};

export function CoverageList({ devices }: { devices: Device[] }) {
  if (devices.length === 0) {
    return (
      <EmptyState message="All known devices are currently routed through the monitoring proxy." />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Device</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {d.employeeId ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.department ?? "—"}
              </TableCell>
              <TableCell>
                {d.coverageReason
                  ? coverageReasonLabels[d.coverageReason] ?? d.coverageReason
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className="bg-warning/15 text-[var(--warning)] ring-1 ring-warning/25"
                >
                  Not monitored
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
