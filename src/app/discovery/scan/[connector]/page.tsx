import { notFound, redirect } from "next/navigation";

import { ScanResultView } from "@/components/discovery/scan-result";
import { getScanResult, type ConnectorId } from "@/lib/discovery-mock-data";

type PageProps = {
  params: Promise<{ connector: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export function generateStaticParams() {
  return [
    { connector: "postgres" },
    { connector: "mysql" },
    { connector: "mongodb" },
    { connector: "file-server" },
    { connector: "server" },
    { connector: "saas" },
    { connector: "email" },
    { connector: "backups" },
  ];
}

export default async function DiscoveryScanPage({
  params,
  searchParams,
}: PageProps) {
  const { connector } = await params;
  const { saved } = await searchParams;

  if (!getScanResult(connector)) {
    notFound();
  }

  // Completed / rescanned saves live on the dedicated workspace (no stepper).
  if (saved) {
    redirect(`/discovery/saved/${saved}`);
  }

  if (connector === "postgres") {
    redirect("/discovery/connect/postgres");
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
      <ScanResultView connectorId={connector as ConnectorId} />
    </main>
  );
}
