import { NextResponse } from "next/server";

import {
  getPaginatedScanFindings,
  normalizeFindingsPage,
  normalizeFindingsPageSize,
} from "@/lib/discovery-findings-pagination";
import type { ConnectorId } from "@/lib/discovery-mock-data";

type Params = { params: Promise<{ connector: string }> };

export async function GET(request: Request, { params }: Params) {
  const { connector } = await params;
  const { searchParams } = new URL(request.url);
  const page = normalizeFindingsPage(searchParams.get("page"));
  const pageSize = normalizeFindingsPageSize(searchParams.get("pageSize"));

  const response = getPaginatedScanFindings({
    connectorId: connector as ConnectorId,
    page,
    pageSize,
  });

  if (!response) {
    const error =
      connector === "postgres"
        ? "Postgres findings are available only from saved live scan results"
        : "Connector not found";
    return NextResponse.json({ error }, { status: 404 });
  }

  return NextResponse.json(response);
}
