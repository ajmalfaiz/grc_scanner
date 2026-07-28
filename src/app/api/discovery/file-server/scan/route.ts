import { NextResponse } from "next/server";

import {
  normalizeFileServerScopeValues,
  runFileServerScan,
  safeFileServerErrorMessage,
  validateFileServerConnectionValues,
} from "@/lib/discovery/file-server/scan";

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
    const connection = validateFileServerConnectionValues(
      record.connectionValues,
    );
    const scope = normalizeFileServerScopeValues(record.scopeValues ?? {});
    const result = await runFileServerScan(connection, scope);
    return NextResponse.json(result);
  } catch (error) {
    const message = safeFileServerErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
