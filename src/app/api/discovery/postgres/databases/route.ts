import { NextResponse } from "next/server";

import { listPostgresDatabases } from "@/lib/discovery/postgres/list-databases";
import {
  safeScanErrorMessage,
  validatePostgresAuthValues,
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
    const auth = validatePostgresAuthValues(record.connectionValues);
    const databases = await listPostgresDatabases(
      auth,
      record.connectionValues.bootstrapDatabase ??
        record.connectionValues.database,
    );
    return NextResponse.json({
      ok: true,
      databases,
      message:
        databases.length === 1
          ? `Found 1 database`
          : `Found ${databases.length} databases`,
    });
  } catch (error) {
    const message = safeScanErrorMessage(error).replace(
      /^Scan failed/,
      "Could not list databases",
    );
    const status = /required|Invalid|Port must|Select at least/i.test(
      error instanceof Error ? error.message : "",
    )
      ? 400
      : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
