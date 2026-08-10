import { describe, expect, it, vi } from "vitest";

import type { EmailClient } from "@/lib/discovery/email/connect";
import {
  resolveSinceDate,
  validateEmailConnectionValues,
} from "@/lib/discovery/email/connection-values";
import { runEmailScan, safeEmailScanErrorMessage } from "@/lib/discovery/email/scan";

vi.mock("@/lib/discovery/pii-detectors", () => ({
  detectPiiInValuesDetailed: vi.fn(async (values: unknown[]) => {
    const map = new Map();
    const joined = values.map(String).join(" ");
    if (/@/.test(joined)) {
      map.set("Email", {
        piiType: "Email",
        hitCount: 1,
        matchedRecords: 1,
        detectorIds: ["openredaction.email.v1"],
        category: "contact",
        riskLevel: "high",
        validators: ["openredaction"],
        reasons: ["OpenRedaction detected EMAIL"],
      });
    }
    return map;
  }),
}));

const RAW_MESSAGE = Buffer.from(
  [
    "From: Alice <alice@example.com>",
    "To: Bob <bob@example.com>",
    "Subject: Invoice details",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Please reach me at alice@example.com for the invoice.",
    "",
  ].join("\r\n"),
);

describe("email connection-values", () => {
  it("requires host, username, password", () => {
    expect(() => validateEmailConnectionValues({})).toThrow(/host is required/);
  });

  it("defaults mailboxes to INBOX", () => {
    const values = validateEmailConnectionValues({
      host: "imap.example.com",
      username: "me@example.com",
      password: "secret",
    });
    expect(values.mailboxes).toEqual(["INBOX"]);
    expect(values.port).toBe("993");
  });

  it("splits comma-separated mailboxes", () => {
    const values = validateEmailConnectionValues({
      host: "imap.example.com",
      username: "me@example.com",
      password: "secret",
      mailboxes: "INBOX, Sent, Archive",
    });
    expect(values.mailboxes).toEqual(["INBOX", "Sent", "Archive"]);
  });
});

describe("resolveSinceDate", () => {
  it("returns undefined for 'all'", () => {
    expect(resolveSinceDate("all")).toBeUndefined();
  });

  it("computes a lookback date", () => {
    const date = resolveSinceDate("30");
    expect(date).toBeInstanceOf(Date);
  });
});

describe("runEmailScan", () => {
  it("fetches messages via the injected client and detects PII in content", async () => {
    const fakeClient: EmailClient = {
      async fetchMailboxMessages(mailbox) {
        if (mailbox !== "INBOX") return { messages: [] };
        return { messages: [{ uid: 1, source: RAW_MESSAGE }] };
      },
      async test() {
        return { message: "ok" };
      },
      async close() {},
    };

    const result = await runEmailScan(
      {
        host: "imap.example.com",
        port: "993",
        username: "me@example.com",
        password: "secret",
        tls: "true",
        mailboxes: ["INBOX"],
      },
      {
        coverageMode: "sample",
        maxMessagesPerMailbox: "200",
        lookbackDays: "90",
        includeAttachments: "no",
      },
      { client: fakeClient },
    );

    expect(result.scopeValue).toBe(1);
    expect(result.findings.some((f) => f.piiType === "Email" && f.location === "INBOX")).toBe(true);
    expect(result.scanRun?.connectorId).toBe("email");
  });

  it("records a permission_denied coverage issue when a mailbox can't be opened", async () => {
    const fakeClient: EmailClient = {
      async fetchMailboxMessages() {
        return { messages: [], error: "not authorized to open mailbox" };
      },
      async test() {
        return { message: "ok" };
      },
      async close() {},
    };

    const result = await runEmailScan(
      {
        host: "imap.example.com",
        port: "993",
        username: "me@example.com",
        password: "secret",
        tls: "true",
        mailboxes: ["Restricted"],
      },
      { maxMessagesPerMailbox: "200", lookbackDays: "90", includeAttachments: "no" },
      { client: fakeClient },
    );

    expect(result.coverageIssues?.some((i) => i.status === "permission_denied")).toBe(true);
  });
});

describe("safeEmailScanErrorMessage", () => {
  it("maps auth errors", () => {
    expect(safeEmailScanErrorMessage(new Error("Invalid login or password"))).toMatch(
      /Authentication failed/,
    );
  });
});
