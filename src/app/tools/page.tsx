import { PageHeader } from "@/components/ui/stat-card";
import { ToolsRegistry } from "@/components/tools/tools-registry";
import { getAiTools } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const tools = await getAiTools();

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Approved tools registry"
        description="Policy side of the module — recognised AI domains marked approved, unapproved, or under review. Kept separate from monitoring."
      />
      <ToolsRegistry tools={tools} />
    </main>
  );
}
