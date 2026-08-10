# Gaps, Next Steps, and Bottlenecks

Status after (1) making every connector real and removing all mock/seeded data, and (2) implementing background jobs, scheduling, and a set of connector-level improvements from round 1's recommendations. Read this alongside [WHAT-WHY-HOW.md](./WHAT-WHY-HOW.md) (architecture) and [HOW-PII-IS-IDENTIFIED.md](./HOW-PII-IS-IDENTIFIED.md) (detection mechanics).

---

## 1. What changed — round 1 (all connectors real)

- **All eight connectors are real, live scanners** — Postgres, MySQL, MongoDB, File server (SMB/SFTP), Server (SSH log/config), SaaS/business app (generic REST API), Email (IMAP), Backups & archives. All hardcoded/seeded findings were deleted; every connector starts empty until a real scan runs.
- **The SaaS connector is provider-agnostic by design** — no vendor names anywhere in code or UI. New providers are added as *configuration* (base URL, auth, resource paths), not code.
- **A second, entirely unrelated module was removed**: `/`, `/findings`, `/tools`, `/coverage`, `governance-store.ts`, `queries.ts` — a disconnected, mock-only "AI usage monitoring" prototype that wasn't linked from navigation. The app root now redirects to `/discovery`.
- **Paper records** and **Endpoints** were removed entirely (explicit decision — not achievable for real inside a web app; see §6).

## 2. What changed — round 2 (this pass)

- **Background job runner** (`src/lib/jobs/job-store.ts`) — scans now start as a server-side job and the browser polls for status (`POST /api/discovery/jobs`, `GET /api/discovery/jobs/[id]`) instead of blocking on one long HTTP request. Removes the request-timeout ceiling on large/slow scans. In-memory only — see §3.
- **Connector registry** (`src/lib/discovery/registry.ts` + a `connector.ts` per connector) — a single place that maps every `ConnectorId` to its real `testConnection`/`scan` implementation, used by the job runner so it never has to call this app's own HTTP API from itself.
- **Scheduled/recurring scans** (`src/lib/jobs/schedule-store.ts`) — create a schedule from any saved connection ("Schedule" button on the connection workspace), pick an interval, and it runs automatically via an in-process ticker. New `/discovery/schedules` page: run history, enable/disable, run now, delete, and "apply latest result to saved connection." In-memory only — see §3.
- **Backups: `.tar` / `.tar.gz` support** added alongside `.zip` (`src/lib/discovery/backups/archive.ts`, using `tar-stream` + `node:zlib`). `.7z` / `.rar` remain unsupported (proprietary/complex formats, no lightweight pure-JS reader).
- **SaaS: OAuth2 client-credentials auth** — token URL + client ID/secret; a token is fetched once per scan and reused across every resource fetch (cached in-process until near expiry). **Cursor pagination** — follows a `next_cursor`/`nextPageToken`/`next`-style field (auto-detected, or an explicit dot-path), in addition to page-number pagination.
- **Rate-limit-aware retries** — the SaaS HTTP client and the IMAP mailbox fetch both retry transient failures (HTTP 429/5xx honoring `Retry-After`; IMAP timeouts/connection resets/"too many connections") with capped exponential backoff before giving up and reporting a distinct coverage issue.
- **MySQL multi-database scanning** — a `databaseMode` (all/selected) + database picker matching Postgres's UX, backed by a real `SHOW DATABASES` listing endpoint (`/api/discovery/mysql/databases`) and catalog queries scoped across the selected databases in one connection.
- A shared `DatabasePicker` component and `database-selection.ts` module now back both Postgres and MySQL (previously Postgres-only, duplicated logic).

---

## 3. The big remaining structural gap: no database, no auth

This was an explicit, discussed trade-off for this pass (you chose "skip DB and auth, build jobs + scheduling on top of the existing model"), not an oversight. Concretely:

- **Saved connections still live only in the browser** (`localStorage`). Jobs and schedules live only in **this Node process's memory**. Three different persistence stories, none of them durable.
- **Schedule credentials are a materially larger exposure than before.** A schedule holds connection credentials (potentially including passwords) in plaintext server memory for as long as the schedule exists, so it can run unattended. This is different from — and more sensitive than — the existing "browser-only, opt-in" secret storage model. It is safe to run locally / on a single trusted machine; it is **not** safe to expose on a shared or multi-tenant deployment as-is.
- **Nothing survives a restart.** Server restart = every job, schedule, and its run history disappears. There's no reconciliation, no "recover in-flight scans."
- **Serverless hosting caveat.** The job runner and scheduler rely on a persistent Node process (`setInterval`, a fire-and-forget async function kept alive by the process). On serverless/function-per-request hosting (e.g. Vercel's default), the process can be frozen or killed once an HTTP response is sent, so background jobs and the scheduler's ticker are **not reliable there** without a platform-specific keep-alive mechanism. This works as designed on `next start` / a container / a VM — anywhere the Node process stays alive between requests.
- **No authentication.** Anyone who can load the app can create schedules holding real credentials, see (redacted) schedule details, and trigger scans. There's no login, no per-user isolation, no audit log of who did what.

**The fix for all of the above is the same fix:** add a real backend (database + auth). That was, and remains, the single highest-leverage next step — it turns the job/schedule stores from "in-memory demo" into "durable, secure, multi-user." See §5.

---

## 4. Known gaps, per connector

| Connector | Gap | Why it's there |
|---|---|---|
| MongoDB | Field-name triage is derived from the *same* sampled documents used for content detection, not a separate metadata-only step | MongoDB is schemaless — there's no field catalog that doesn't require reading at least a document sample |
| Server (SSH) | No `sudo`/privilege escalation; only reads what the given account can already read | Real remote command execution beyond file reads was out of scope |
| SaaS / REST | OAuth2 covers client-credentials only (no authorization-code/PKCE user-delegated flows); cursor pagination assumes the cursor comes back in the JSON body, not response headers (e.g. `Link` header pagination isn't parsed) | Client-credentials + body-based cursors cover the common case; header-based pagination (GitHub-style `Link`) would need a small parser addition |
| Email (IMAP) | "Chat" (Slack, Teams, etc.) still isn't built — IMAP only | Each chat vendor needs its own OAuth app registration; deferred to a future SaaS-connector "resource preset" |
| Backups & archives | `.7z` and `.rar` still unsupported | No lightweight pure-JS reader for either; would need a native/WASM dependency |
| All content-sampling connectors | India-specific types (PAN, GSTIN, UPI, Passport, Voter ID) are primarily caught via **name triage**, not content matching | OpenRedaction's own pattern coverage — a detector-library limitation, not something either round of this work touched |

---

## 5. Next steps, roughly in priority order

1. **Add a real backend database + auth** (§3) — the biggest unlock, and now more urgent than before: it fixes the credential-exposure trade-off the job/schedule stores introduced, and turns "saved connections," "jobs," and "schedules" into one durable, multi-user-safe model instead of three different ephemeral ones.
   - Suggested shape: Postgres via Drizzle, tables for `connections` (encrypted credentials), `scan_runs`, `findings`, `schedules`, `schedule_runs`; a real job queue (BullMQ + Redis, or a DB-backed outbox) replacing the in-memory job store; simple session-cookie auth as a first cut.
2. **Encrypted credential storage** — once there's a database, store credentials with envelope encryption (KMS-managed key), never returned to the client after initial entry.
3. **A real job queue** — replace `src/lib/jobs/job-store.ts`'s in-memory Map with a durable queue so jobs survive restarts and work correctly on serverless hosting (§3's caveat).
4. **`Link`-header pagination for SaaS** — covers GitHub-style APIs that don't put the cursor in the JSON body.
5. **OAuth2 authorization-code/PKCE for SaaS** — needed for providers that require a user-delegated (not machine-to-machine) grant.
6. **Chat-app providers under the SaaS connector** (Slack, Teams, etc.) — one at a time, each as a documented resource-path + auth preset.
7. **`.7z` / `.rar` support for Backups** — lowest priority; niche relative to `.zip`/`.tar`/`.tar.gz` already covered.

---

## 6. What's genuinely out of scope for a web app (and why)

- **True endpoint/device scanning** (laptops, desktops) needs a locally-installed agent with OS-level filesystem access — a different product (an endpoint agent + fleet management backend), not an extension of this web app.
- **Paper records** have no digital representation to connect to. An OCR-upload flow (scan paper → PDF/image → upload → reuse the existing PDF/image extraction + PII pipeline) was considered and explicitly declined for this pass; it would be a small, mostly-mechanical addition if wanted later.

---

## 7. Bottlenecks and fixes from round 1 (still accurate)

### Large sources (many tables/collections/mailboxes/resources)
Every connector still enforces a hard cap (100 tables, 200 rows/table in sample mode, etc.) — now less critical since scans run as background jobs (§2) rather than inside one HTTP request, but the caps remain a deliberate bound on how much any single scan will read.

### MongoDB / SaaS field-explosion on deeply nested or highly variable documents
The `maxDepth` scope control caps this today. A further refinement — field-path *frequency* thresholding, only running content detection on paths that appear across some minimum share of sampled documents — is still unbuilt.

### jsdom test environment breaks binary buffer parsing
**Found and fixed in round 1, still relevant:** the default Vitest environment (`jsdom`) mis-parses ZIP/TAR central-directory-style bytes when a binary-buffer library (`adm-zip`, `tar-stream`) is exercised under it. Fix: force `// @vitest-environment node` at the top of any test file that parses binary formats (see `src/lib/discovery/backups/scan.test.ts`), and keep `src/test/setup.ts`'s `typeof window !== "undefined"` guards so the shared setup file works under both environments.

### `vi.mock` + `restoreMocks: true` silently wipes factory-built mocks
**Found and fixed in round 2:** this project's `vitest.config.ts` sets `restoreMocks: true`, which calls `vi.restoreAllMocks()` before every test — including `vi.fn()`s built and configured *inside* a `vi.mock(() => ...)` factory (e.g. `vi.fn().mockImplementation(...)`), silently turning them back into no-ops before the first test even runs. Symptom: a mocked class/module works in isolation (`node -e`) but the mock never seems to get called under Vitest, with no error. Fix: use `vi.hoisted()` to build any stateful fake needed inside a `vi.mock` factory, and prefer a **plain class/function** over `vi.fn().mockImplementation(...)` for anything the factory returns — plain functions aren't touched by `restoreMocks`. See `src/lib/discovery/email/connect.test.ts` and `src/lib/jobs/job-store.test.ts` for the pattern.
