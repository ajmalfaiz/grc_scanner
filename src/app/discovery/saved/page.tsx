import { SavedConnectionsList } from "@/components/discovery/saved-connections-list";
import { PageHeader } from "@/components/ui/stat-card";

export default function SavedConnectionsPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 overflow-y-auto p-6">
      <PageHeader
        title="Saved connections"
        description="Connections saved in this browser after a discovery scan. Passwords and keys are stored only if you explicitly agree — otherwise you’ll be asked on each rescan."
      />
      <SavedConnectionsList />
    </div>
  );
}
