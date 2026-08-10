import { NextResponse } from "next/server";

import { testEmailConnection } from "@/lib/discovery/email/connect";
import {
  safeEmailScanErrorMessage,
  validateEmailConnectionValues,
} from "@/lib/discovery/email/scan";

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
    const connection = validateEmailConnectionValues(record.connectionValues);
    const result = await testEmailConnection(connection);
    return NextResponse.json({
      ok: true,
      message: result.message,
      serverVersion: "imap",
      details: { host: connection.host, mailboxes: connection.mailboxes.join(", ") },
    });
  } catch (error) {
    const message = safeEmailScanErrorMessage(error);
    const status = /required|Invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
