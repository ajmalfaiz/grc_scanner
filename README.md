# Jethur Discovery

A PII discovery scanner built on Next.js. Connect a real data source, run a live scan, review findings — no mock or seeded data anywhere in the app.

See [docs/WHAT-WHY-HOW.md](docs/WHAT-WHY-HOW.md) for the full picture, [docs/HOW-PII-IS-IDENTIFIED.md](docs/HOW-PII-IS-IDENTIFIED.md) for detection mechanics, and [docs/GAPS-AND-NEXT-STEPS.md](docs/GAPS-AND-NEXT-STEPS.md) for known limitations and what's next.

## Connectors (all live)

Postgres · MySQL (multi-database) · MongoDB · File server (SMB/SFTP) · Server (SSH log/config) · SaaS / business app (generic REST API, bearer/API-key/basic/OAuth2 client-credentials, page or cursor pagination) · Email (IMAP) · Backups & archives (zip/tar/tar.gz)

Scans run as background jobs (no request-timeout ceiling) and can be scheduled to run on a recurring interval from `/discovery/schedules`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/discovery`, the connector picker.

No database is required to run the app: saved connections and scan results are cached in the browser; background jobs and schedules live in the server process's memory. See [docs/GAPS-AND-NEXT-STEPS.md](docs/GAPS-AND-NEXT-STEPS.md) §3 for what that trades off (notably: a schedule holds its credentials in server memory) and what adding a real backend would look like.

### Optional: LLM-assisted name triage

Metadata-only column/field-name triage can optionally be assisted by Gemini. It is **off by default** and never receives sampled row/document/cell values — only schema, table/collection, and field names.

```bash
# .env
GEMINI_API_KEY=your-key
DISCOVERY_ALLOW_EXTERNAL_LLM=true
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Watch mode |

## Tech stack

Next.js (App Router) · React · Tailwind · shadcn/Base UI · Recharts · [OpenRedaction](https://www.npmjs.com/package/openredaction) for local PII detection · `postgres`, `mysql2`, `mongodb`, `ssh2-sftp-client`, `@awo00/smb2`, `imapflow` + `mailparser`, `adm-zip` for real connector protocols
