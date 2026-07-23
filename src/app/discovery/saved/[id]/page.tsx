import { SavedConnectionWorkspace } from "@/components/discovery/saved-connection-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ panel?: string }>;
};

function parsePanel(panel?: string): "connection" | "scope" | null {
  if (panel === "connection" || panel === "scope") return panel;
  return null;
}

export default async function SavedConnectionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { panel } = await searchParams;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
      <SavedConnectionWorkspace
        key={`${id}-${panel ?? "none"}`}
        id={id}
        initialPanel={parsePanel(panel)}
      />
    </main>
  );
}
