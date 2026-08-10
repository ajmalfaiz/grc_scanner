import { NextResponse } from "next/server";

import { testServerConnection } from "@/lib/discovery/server/connect";
import {
  safeServerErrorMessage,
  validateServerConnectionValues,
} from "@/lib/discovery/server/scan";

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
    const connection = validateServerConnectionValues(record.connectionValues);
    const result = await testServerConnection(connection);
    return NextResponse.json({
      ok: true,
      message: result.message,
      serverVersion: "ssh",
      details: result.details,
    });
  } catch (error) {
    const message = safeServerErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
