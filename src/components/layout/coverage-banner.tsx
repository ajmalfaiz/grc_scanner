import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, AlertAction } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CoverageBanner({
  unmonitored,
  total,
}: {
  unmonitored: number;
  total: number;
}) {
  if (unmonitored === 0) return null;

  return (
    <Alert className="border-warning/40 bg-warning/10 text-foreground">
      <AlertTriangle className="text-[var(--warning)]" />
      <AlertTitle>
        {unmonitored} of {total} devices not currently monitored
      </AlertTitle>
      <AlertDescription>
        Devices not routed through the proxy are invisible to domain-level
        detection. Coverage gaps are reportable facts, not settings details.
      </AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          className="border-warning/50 bg-background"
          nativeButton={false}
          render={<Link href="/coverage" />}
        >
          Open coverage report
        </Button>
      </AlertAction>
    </Alert>
  );
}
