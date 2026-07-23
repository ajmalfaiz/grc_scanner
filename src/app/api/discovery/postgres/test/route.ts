import { NextResponse } from "next/server";

import { testPostgresConnection } from "@/lib/discovery/postgres/connect";
import {
  safeScanErrorMessage,
  validatePostgresConnectionValues,
} from "@/lib/discovery/postgres/scan";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = (body ?? {}) as {
    connectionValues?: Record<string, string>;
  };

  if (!record.connectionValues || typeof record.connectionValues !== "object") {
    return NextResponse.json(
      { error: "connectionValues is required" },
      { status: 400 },
    );
  }

  try {
    const connection = validatePostgresConnectionValues(
      record.connectionValues,
    );
    const result = await testPostgresConnection(connection);
    return NextResponse.json({
      ok: true,
      serverVersion: result.serverVersion,
      message: `Connected successfully (PostgreSQL ${result.serverVersion})`,
    });
  } catch (error) {
    const message = safeScanErrorMessage(error).replace(
      /^Scan failed/,
      "Connection failed",
    );
    const status = /required|Invalid|Port must/i.test(
      error instanceof Error ? error.message : "",
    )
      ? 400
      : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
