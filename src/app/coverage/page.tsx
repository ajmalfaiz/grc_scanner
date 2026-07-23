import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CoverageList } from "@/components/coverage/coverage-list";
import { CoverageBanner } from "@/components/layout/coverage-banner";
import { PageHeader } from "@/components/ui/stat-card";
import { getOverviewStats, getUnmonitoredDevices } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const [devices, stats] = await Promise.all([
    getUnmonitoredDevices(),
    getOverviewStats(),
  ]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Coverage report"
        description="Devices not routed through the monitoring proxy are invisible to domain-level detection. A clean dashboard on partial coverage is worse than an honest, smaller one."
      />

      <div className="mb-6">
        <CoverageBanner
          unmonitored={stats.unmonitoredDevices}
          total={stats.totalDevices}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Why this screen exists</CardTitle>
          <CardDescription>
            Personal phones, unmanaged laptops, and off-network use leave no SNI
            trail for this approach. Reporting those gaps explicitly prevents
            false confidence — the same principle used for unscanned files in the
            DPDP discovery scanner.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Treat uncovered devices as first-class reportable findings, not hidden
          configuration debt.
        </CardContent>
      </Card>

      <CoverageList devices={devices} />
    </main>
  );
}
