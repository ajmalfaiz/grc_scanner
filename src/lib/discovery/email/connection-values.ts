import type {
  EmailConnectionValues,
  EmailScopeValues,
} from "@/lib/discovery/email/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function validateEmailConnectionValues(
  values: Record<string, string>,
): EmailConnectionValues {
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const password = requireTrimmed(values, "password");
  const port = (values.port ?? "993").trim() || "993";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }
  const mailboxes = (values.mailboxes ?? "INBOX")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return {
    host,
    port,
    username,
    password,
    tls: values.tls === "false" ? "false" : "true",
    mailboxes: mailboxes.length > 0 ? mailboxes : ["INBOX"],
  };
}

export function normalizeEmailScopeValues(
  values: Record<string, string>,
): EmailScopeValues {
  return {
    coverageMode: values.coverageMode ?? "sample",
    maxMessagesPerMailbox: values.maxMessagesPerMailbox ?? "200",
    lookbackDays: values.lookbackDays ?? "90",
    includeAttachments: values.includeAttachments === "no" ? "no" : "yes",
  };
}

export function resolveSinceDate(lookbackDays: string): Date | undefined {
  if (lookbackDays === "all") return undefined;
  const days = Number.parseInt(lookbackDays, 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
