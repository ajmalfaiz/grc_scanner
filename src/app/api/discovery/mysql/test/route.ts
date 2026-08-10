import { NextResponse } from "next/server";

import { testMysqlConnection } from "@/lib/discovery/mysql/connect";
import {
  safeMysqlScanErrorMessage,
  validateMysqlConnectionValues,
} from "@/lib/discovery/mysql/scan";

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
    const connection = validateMysqlConnectionValues(record.connectionValues);
    const result = await testMysqlConnection(connection);
    return NextResponse.json({
      ok: true,
      message: `Connected to MySQL ${result.serverVersion} at ${connection.host}:${connection.port}`,
      serverVersion: result.serverVersion,
      details: { host: connection.host, database: connection.database },
    });
  } catch (error) {
    const message = safeMysqlScanErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
