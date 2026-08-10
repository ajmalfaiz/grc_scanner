import { SchedulesList } from "@/components/discovery/schedules-list";
import { PageHeader } from "@/components/ui/stat-card";

export default function SchedulesPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 overflow-y-auto p-6">
      <PageHeader
        title="Scheduled scans"
        description="Recurring background scans, created from a saved connection. Runs entirely in this server's memory — credentials and history are lost on restart. No database or auth in this build; see docs/GAPS-AND-NEXT-STEPS.md."
      />
      <SchedulesList />
    </div>
  );
}
