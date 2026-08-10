import { NextResponse } from "next/server";

import { validateMysqlAuthValues } from "@/lib/discovery/mysql/connection-values";
import { listMysqlDatabases } from "@/lib/discovery/mysql/list-databases";
import { safeMysqlScanErrorMessage } from "@/lib/discovery/mysql/scan";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as { connectionValues?: Record<string, string> };

  if (!record.connectionValues || typeof record.connectionValues !== "object") {
    return NextResponse.json({ error: "connectionValues is required" }, { status: 400 });
  }

  try {
    const auth = validateMysqlAuthValues(record.connectionValues);
    const databases = await listMysqlDatabases({
      ...auth,
      databaseMode: "all",
      databases: "",
      database: "",
    });
    return NextResponse.json({
      ok: true,
      databases,
      message: databases.length === 1 ? "Found 1 database" : `Found ${databases.length} databases`,
    });
  } catch (error) {
    const message = safeMysqlScanErrorMessage(error).replace(/^Scan failed/, "Could not list databases");
    const status = /required|Invalid/i.test(error instanceof Error ? error.message : "") ? 400 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
