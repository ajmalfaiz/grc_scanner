import {
  Activity,
  MonitorCheck,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { ToolUsageChart, TrendChart } from "@/components/dashboard/charts";
import { CoverageBanner } from "@/components/layout/coverage-banner";
import { PageHeader, StatCard } from "@/components/ui/stat-card";
import {
  getOverviewStats,
  getUsageByTool,
  getUsageTrend,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [stats, usageByTool, trend] = await Promise.all([
    getOverviewStats(),
    getUsageByTool(),
    getUsageTrend(30),
  ]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        description="How much unmanaged AI usage exists right now — domain and volume only, never prompt content."
      />

      <div className="mb-6">
        <CoverageBanner
          unmonitored={stats.unmonitoredDevices}
          total={stats.totalDevices}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Devices monitored"
          value={formatNumber(stats.monitoredDevices)}
          hint={`${formatNumber(stats.totalDevices)} known devices total`}
          icon={MonitorCheck}
          tone="primary"
        />
        <StatCard
          label="With AI activity"
          value={formatNumber(stats.devicesWithActivity)}
          hint="Distinct devices contacting AI domains"
          icon={Activity}
        />
        <StatCard
          label="Unapproved-tool usage"
          value={formatNumber(stats.unapprovedUsageCount)}
          hint="Findings against unapproved domains"
          icon={ShieldAlert}
          tone="destructive"
        />
        <StatCard
          label="No coverage"
          value={formatNumber(stats.unmonitoredDevices)}
          hint="Not routed through monitoring proxy"
          icon={Unplug}
          tone="warning"
        />
      </div>

      <div className="mb-6">
        <ToolUsageChart data={usageByTool} />
      </div>

      <TrendChart
        data={trend.map((row) => ({
          day: row.day,
          connectionCount: row.connectionCount,
        }))}
      />
    </main>
  );
}
