import { describe, expect, it, vi } from "vitest";

import { createImapEmailClient } from "@/lib/discovery/email/connect";

// vi.mock factories are hoisted above the rest of the file, so any state
// they close over must be created via vi.hoisted() to avoid a TDZ error.
// A plain class (not vi.fn()) is used because this project's vitest config
// sets restoreMocks: true, which restores vi.fn()-based implementations
// (including ones built inside a vi.mock factory) before every test,
// silently turning a `vi.fn().mockImplementation(...)` fake back into a
// no-op. A plain class/function is immune to that.
const { state, FakeImapFlow } = vi.hoisted(() => {
  const state = { lockAttempts: 0, throwTransient: false, throwFatal: false };

  class FakeImapFlow {
    async connect() {}
    async list() {
      return [];
    }
    async getMailboxLock() {
      state.lockAttempts += 1;
      if (state.throwFatal) {
        throw new Error("Mailbox does not exist — no permission to access");
      }
      if (state.throwTransient && state.lockAttempts === 1) {
        throw new Error("ETIMEDOUT: connection timed out");
      }
      return { release: () => {} };
    }
    async search() {
      return [];
    }
    async *fetch() {
      // No messages in this fake — matches an empty search() result.
    }
    async logout() {}
    close() {}
  }

  return { state, FakeImapFlow };
});

vi.mock("imapflow", () => ({ ImapFlow: FakeImapFlow }));

describe("createImapEmailClient retry behavior", () => {
  it("retries once on a transient error and succeeds", async () => {
    state.lockAttempts = 0;
    state.throwTransient = true;
    state.throwFatal = false;

    const client = createImapEmailClient({
      host: "imap.example.com",
      port: "993",
      username: "me@example.com",
      password: "secret",
      tls: "true",
      mailboxes: ["INBOX"],
    });

    const result = await client.fetchMailboxMessages("INBOX", { limit: 10 });

    expect(state.lockAttempts).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it("does not retry a fatal (non-transient) error", async () => {
    state.lockAttempts = 0;
    state.throwTransient = false;
    state.throwFatal = true;

    const client = createImapEmailClient({
      host: "imap.example.com",
      port: "993",
      username: "me@example.com",
      password: "secret",
      tls: "true",
      mailboxes: ["Restricted"],
    });

    const result = await client.fetchMailboxMessages("Restricted", { limit: 10 });

    expect(state.lockAttempts).toBe(1);
    expect(result.error).toMatch(/no permission/i);
  });
});
