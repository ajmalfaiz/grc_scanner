# Jethur Discovery — What, Why, How

A PII discovery scanner — connect a real data source, run a live scan, review findings.

> Every connector is real. No mock or seeded data anywhere in the app.

---

## What

**Jethur Discovery** finds where personal and sensitive data (PII) lives across an organisation's systems — databases, file shares, servers, SaaS apps, email, and backup archives — without storing the raw values it finds.

### What you can do

| Screen | Route | Purpose |
|--------|-------|---------|
| **Connector picker** | `/discovery` | Choose a data source to scan |
| **Connect** | `/discovery/connect/[connector]` | Enter real connection details; optionally test the connection |
| **Scope** | `/discovery/scope/[connector]` | Choose sampled vs deep scan and connector-specific knobs |
| **Result / saved workspace** | `/discovery/saved/[id]` | Findings table, coverage summary, coverage gaps, rescan, schedule |
| **Saved connections** | `/discovery/saved` | Every connection you've scanned, revisit or rescan any of them |
| **Scheduled scans** | `/discovery/schedules` | Recurring scans created from a saved connection — run history, enable/disable, run now |

### The eight connectors (all live)

| Connector | Protocol | What it scans |
|---|---|---|
| Postgres | `postgres` driver | Tables/columns, sampled rows |
| MySQL | `mysql2` | Tables/columns, sampled rows |
| MongoDB | `mongodb` driver | Collections, sampled documents (field paths) |
| File server | SMB / SFTP | Files on a share — CSV, XLSX, DOCX, PDF, JSON, text |
| Server | SSH/SFTP | Log and config files at named paths, line-window sampled |
| SaaS / business app | REST + JSON over HTTP | Any API you point it at — base URL, auth, resource paths. Provider-agnostic by design so more apps are added as configuration, not code |
| Email | IMAP | Any mailbox — subject/from/to/body + readable attachments |
| Backups and archives | Local path / SFTP / SMB | `.zip` / `.tar` / `.tar.gz` archives, extracting and scanning each readable member |

### What it deliberately does *not* do

- Store raw sampled cell/document/message/file values — only type, location, counts, and evidence summaries
- Guess at PII in ways that bypass user-supplied credentials — every scan needs a real, working connection
- Enforce or block anything — read-only discovery

---

## Why

Most orgs don't know where sensitive data actually lives until an audit, breach, or compliance deadline forces the question. Manual data-mapping doesn't scale past a handful of systems, and heavyweight enterprise DLP tools are often too expensive or too invasive to run everywhere.

Jethur Discovery is the lightweight middle ground: point it at a real system, get back **type, location, confidence, and coverage** — never the underlying sensitive values — so a security or privacy team can triage quickly and stay honest about what wasn't fully scanned.

---

## How

Every connector follows the same four-stage pipeline (mechanics vary by source type — see [How PII Is Identified](./HOW-PII-IS-IDENTIFIED.md)):

```
Catalog → Name/field triage → Content sample (bounded) → Report
                                      │
                                      ▼
                        OpenRedaction (in-process, no network)
```

1. **Catalog** — list what exists (tables, collections, files, mailboxes, resources, archives) without reading content
2. **Triage** — score names/paths against known PII naming patterns (email, aadhaar, pan, …), optionally assisted by an LLM on **metadata only** (opt-in via `DISCOVERY_ALLOW_EXTERNAL_LLM=true`)
3. **Content sample** — pull a bounded sample and run it through OpenRedaction locally; never send content anywhere
4. **Report** — findings (type, location, confidence, detection method) + a coverage summary of what wasn't fully scanned and why

### Architecture

```
Browser
  └── Discovery wizard (connect → scope → scan)
        └── POST /api/discovery/jobs → { jobId }              (starts a background scan job)
              GET  /api/discovery/jobs/[id]  (polled)          (job status + result)
                    └── src/lib/discovery/registry.ts           (ConnectorId → real connector)
                          └── src/lib/discovery/<connector>/*    (real connect + catalog + sample + merge)
                                └── openredaction (local PII detection)
Saved connections + last scan result → browser localStorage (no server DB)
Jobs + schedules → server process memory (no server DB) — see GAPS-AND-NEXT-STEPS.md §3
```

- Each connector's lib module owns its own connect/catalog/sample/merge logic; shared logic (metadata name-triage rules, PII detector mapping, filesystem walking/extraction, database-selection UI model) lives under `src/lib/discovery/shared/` and `src/lib/discovery/file-server/` and is reused across connectors (e.g. `server` and `backups` both reuse the file-server filesystem + extraction pipeline; `mongodb` and `saas` share the same field-flattening + name-triage engine; `postgres` and `mysql` share the same multi-database picker).
- Scans run as **background jobs**, not inside one HTTP request — the browser starts a job and polls for status, so a slow/large source isn't bound by a single request's timeout. **Scheduled scans** (`/discovery/schedules`) wrap the same job runner with an in-process ticker.
- No server-side database — saved connections live in the browser only; jobs and schedules live in this server process's memory only (lost on restart). See [docs/GAPS-AND-NEXT-STEPS.md](./GAPS-AND-NEXT-STEPS.md) §3 for the trade-offs this creates (especially: schedule credentials sit in server memory, a bigger exposure than the browser-only model) and what a persistence layer would look like.

---

## Related

- [How PII Is Identified](./HOW-PII-IS-IDENTIFIED.md) — detection mechanics, confidence rules
- [Scanning workflow](./SCANNING-WORKFLOW.md) — result shape, UI segregation
- [Gaps, next steps, and bottlenecks](./GAPS-AND-NEXT-STEPS.md) — known limitations and how to close them
