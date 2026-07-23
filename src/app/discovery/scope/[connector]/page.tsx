import { notFound } from "next/navigation";

import { ScanScopeForm } from "@/components/discovery/scan-scope-form";
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
  ];
}

export default async function DiscoveryScopePage({
  params,
  searchParams,
}: PageProps) {
  const { connector } = await params;
  const { saved } = await searchParams;
  const result = getScanResult(connector);

  if (!result) {
    notFound();
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
      <ScanScopeForm
        key={saved ?? "new"}
        connectorId={connector as ConnectorId}
        savedId={saved}
      />
    </main>
  );
}
