import { ImapFlow } from "imapflow";

import {
  CONNECT_TIMEOUT_MS,
  MAX_MESSAGE_BYTES,
  type EmailConnectionValues,
} from "@/lib/discovery/email/types";

export type FetchedMessage = { uid: number; source: Buffer };

/** Thin, testable seam over the IMAP protocol — real connectors implement this with imapflow. */
export type EmailClient = {
  fetchMailboxMessages(
    mailbox: string,
    opts: { since?: Date; limit: number },
  ): Promise<{ messages: FetchedMessage[]; error?: string }>;
  test(): Promise<{ message: string }>;
  close(): Promise<void>;
};

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

/** Transient-looking IMAP/network failures worth a retry — not auth/permission errors. */
const TRANSIENT_ERROR_PATTERN =
  /ETIMEDOUT|ECONNRESET|EPIPE|ECONNREFUSED|timed?\s*out|try again|temporary|too many (simultaneous )?connections|throttl|rate.?limit/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a transient IMAP operation with exponential backoff. Non-transient errors fail fast. */
async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= MAX_RETRIES || !TRANSIENT_ERROR_PATTERN.test(message)) {
        throw error;
      }
      await sleep(Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS));
    }
  }
  throw lastError;
}

export function createImapEmailClient(connection: EmailConnectionValues): EmailClient {
  const client = new ImapFlow({
    host: connection.host,
    port: Number(connection.port),
    secure: connection.tls !== "false",
    auth: { user: connection.username, pass: connection.password },
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
  });

  let connected: Promise<void> | null = null;
  async function ensureConnected() {
    connected ??= client.connect();
    await connected;
  }

  return {
    async test() {
      await ensureConnected();
      const mailboxes = await client.list();
      return { message: `Connected via IMAP to ${connection.host}:${connection.port} (${mailboxes.length} mailboxes visible)` };
    },

    async fetchMailboxMessages(mailbox, opts) {
      try {
        return await withTransientRetry(async () => {
          await ensureConnected();
          const lock = await client.getMailboxLock(mailbox);
          try {
            const uids = opts.since
              ? await client.search({ since: opts.since }, { uid: true })
              : await client.search({ all: true }, { uid: true });

            if (!uids || uids.length === 0) return { messages: [] };

            // Most recent first, bounded by the scan's message cap.
            const selected = [...uids].sort((a, b) => b - a).slice(0, opts.limit);
            const messages: FetchedMessage[] = [];
            for await (const msg of client.fetch(
              selected,
              { source: true, uid: true },
              { uid: true },
            )) {
              if (!msg.source) continue;
              const source =
                msg.source.length > MAX_MESSAGE_BYTES
                  ? msg.source.subarray(0, MAX_MESSAGE_BYTES)
                  : msg.source;
              messages.push({ uid: msg.uid, source: Buffer.from(source) });
            }
            return { messages };
          } finally {
            lock.release();
          }
        });
      } catch (error) {
        return {
          messages: [],
          error: error instanceof Error ? error.message : `Could not open mailbox ${mailbox}`,
        };
      }
    },

    async close() {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    },
  };
}

export async function testEmailConnection(
  connection: EmailConnectionValues,
): Promise<{ ok: true; message: string }> {
  const client = createImapEmailClient(connection);
  try {
    const result = await client.test();
    return { ok: true, message: result.message };
  } finally {
    await client.close();
  }
}
