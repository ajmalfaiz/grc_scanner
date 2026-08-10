import { NextResponse } from "next/server";

import { testSaasConnection } from "@/lib/discovery/saas/client";
import {
  safeSaasScanErrorMessage,
  validateSaasConnectionValues,
} from "@/lib/discovery/saas/scan";

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
    const connection = validateSaasConnectionValues(record.connectionValues);
    const result = await testSaasConnection(connection);
    return NextResponse.json({
      ok: true,
      message: result.message,
      serverVersion: "http",
      details: result.details,
    });
  } catch (error) {
    const message = safeSaasScanErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
