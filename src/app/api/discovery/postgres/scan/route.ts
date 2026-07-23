import { NextResponse } from "next/server";

import {
  normalizePostgresScopeValues,
  runPostgresScan,
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
    scopeValues?: Record<string, string>;
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
    const scope = normalizePostgresScopeValues(record.scopeValues ?? {});
    const result = await runPostgresScan(
      connection,
      scope,
      record.connectionValues,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = safeScanErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
