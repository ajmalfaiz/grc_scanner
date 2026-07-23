import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ApprovalBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  if (status === "approved") {
    return (
      <Badge
        variant="secondary"
        className="bg-success/10 text-success capitalize ring-1 ring-success/20"
      >
        {label}
      </Badge>
    );
  }
  if (status === "unapproved") {
    return (
      <Badge variant="destructive" className="capitalize">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="capitalize">
      {label}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "capitalize",
        confidence === "high"
          ? "bg-primary/10 text-primary ring-1 ring-primary/20"
          : "bg-warning/15 text-[var(--warning)] ring-1 ring-warning/25",
      )}
    >
      {confidence}
    </Badge>
  );
}
