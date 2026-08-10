import { NextResponse } from "next/server";

import { testBackupsConnection } from "@/lib/discovery/backups/connect";
import {
  safeBackupsScanErrorMessage,
  validateBackupsConnectionValues,
} from "@/lib/discovery/backups/scan";

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
    const connection = validateBackupsConnectionValues(record.connectionValues);
    const result = await testBackupsConnection(connection);
    return NextResponse.json({
      ok: true,
      message: result.message,
      serverVersion: connection.sourceType,
      details: result.details,
    });
  } catch (error) {
    const message = safeBackupsScanErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
