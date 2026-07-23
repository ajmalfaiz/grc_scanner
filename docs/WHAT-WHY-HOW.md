# Jethur AI Governance — What, Why, How

Domain-level AI usage monitoring prototype — findings, confidence, and coverage gaps.

> Prototype UI with sample data. Domain and volume signals only; **never prompt content**.

---

## What

**Jethur AI Governance** is an operator console for enterprise AI governance. It shows which devices contact which AI domains, how much traffic that generates, whether those tools are approved, and which devices have no monitoring coverage — without inspecting prompts or decrypting TLS payloads.

It is a **Jethur module / prototype**, not a full gateway, DLP product, or enforcement plane. Approval updates are policy input only; there are no block or enforce actions in this build.

### What you can do

| Screen | Route | Purpose |
|--------|-------|---------|
| **Overview** | `/` | How much unmanaged AI usage exists right now — KPIs, usage-by-tool charts, 30-day trend, and a coverage gap banner |
| **Findings** | `/findings` | One row per device–domain pair; high-confidence matches first; medium confidence in a separate review queue |
| **Approved tools** | `/tools` | Policy registry of recognised AI domains — approved, unapproved, or under review — kept separate from monitoring |
| **Coverage** | `/coverage` | Devices not routed through the monitoring proxy, and why |

### What the product measures

- **Devices monitored** vs known devices total  
- **Devices with AI activity** — distinct devices contacting AI domains  
- **Unapproved-tool usage** — findings against unapproved domains  
- **No coverage** — devices not routed through the monitoring proxy  
- Per finding: connection count, data volume, approval status, confidence (`high` / `medium`), last seen  
- Aggregate **usage trends** over time (domain-level handshake counts)

### What it deliberately does *not* do

- Read or store prompt content  
- Decrypt TLS payloads  
- Block or throttle traffic based on approval status  
- Capture live network traffic in-repo (data is seeded / assumed upstream)

### Data model (at a glance)

| Entity | Role |
|--------|------|
| **Devices** | Endpoints / employees; monitored or gap (`coverage_reason`) |
| **AI tools** | Recognised domains + vendor + `approval_status` |
| **Findings** | One device–domain pair with volume, confidence, last seen |
| **Connection events** | Per-connection timeline under a finding |
| **Usage trends** | Daily aggregate connection counts for the dashboard |

```
devices ──┐
          ├── findings ── connection_events
ai_tools ─┘
usage_trends (standalone aggregates)
```

**Approval status:** `approved` · `unapproved` · `under_review`  
**Confidence:** `high` · `medium` (fuzzy / CDN-shared domains need human review)  
**Coverage reasons:** `unmanaged_device` · `off_network` · `proxy_not_configured` · `unknown`

### Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router), React |
| UI | Tailwind, shadcn / Base UI, Lucide, Recharts |
| Data | PostgreSQL + Drizzle ORM |
| Mutations | REST for tools only (`/api/tools`); findings & coverage are server-rendered |

---

## Why

### The problem

Shadow and unmanaged AI usage is invisible to teams that only maintain approved SaaS lists. Employees use ChatGPT, Claude, Copilot, Cursor, and similar tools on corporate and personal devices. Traditional DLP that inspects prompts is heavy, privacy-sensitive, and often incomplete.

A clean dashboard on **partial** visibility is worse than an honest, smaller one: devices not on the monitoring path look like “no risk” when they are simply unseen.

### The stance this product takes

1. **Detect via domain / TLS signals** (proxy / SNI), not content — privacy-preserving visibility.  
2. **Separate monitoring from policy** — findings are what happened; the tools registry is what you allow.  
3. **Treat coverage gaps as first-class findings** — not hidden configuration debt.  
4. **Triage with confidence** — high-confidence matches vs a medium-confidence review queue for ambiguous domains.  
5. **Curate early** — new AI tools appear constantly; the registry exists so policy can keep up without pretending monitoring equals enforcement.

### Who it is for

- Security / AI governance / compliance reviewing unapproved usage  
- IT / network teams owning proxy coverage  
- Policy owners curating domain approval status  

Not an end-user productivity app — an **operator console** for governance.

### Value in one line

See unmanaged AI usage and blind spots honestly — domain and volume only, never prompts — and keep policy separate from detection.

---

## How

### Detection model (assumed upstream)

This UI is the console for a pipeline that (outside this repo) would:

1. Route corporate traffic through a **monitoring proxy**  
2. Observe **domain / SNI** handshakes to known AI domains  
3. Aggregate into **findings** (connection count, data volume)  
4. Tag **confidence** (`high` vs `medium` for fuzzy / CDN domains)  
5. Report devices **not** on the proxy with a **coverage reason**

Seeded sample data simulates that pipeline so the console can be used end-to-end.

### Application architecture

```
Browser
  └── AppShell (sidebar + header)
        ├── Server Component pages (force-dynamic)
        │     └── lib/queries → Drizzle → PostgreSQL
        └── Client islands
              ├── Tools registry / finding detail → /api/tools
              └── Findings filters (URL search params)
```

- **List pages** load data on the server via Drizzle queries.  
- **Tools** are the only mutable surface over HTTP (`GET` / `POST` / `PATCH` / `DELETE`).  
- **Findings** and **coverage** are read-only in the UI (server-rendered).  
- Changing a tool’s approval from Findings or the registry updates the same `ai_tools` rows.

### Screens and flows

**1. Assess posture — Overview**  
See coverage banner → KPI cards → usage by tool → trend. Banner links to Coverage when devices are unmonitored.

**2. Triage usage — Findings**  
Filter by approval, confidence, and tool. Open a row for detail (domain, volume, coverage note, connection timeline). Optionally update that tool’s approval status (policy only).

**3. Maintain policy — Approved tools**  
Add a recognised domain, change status, or remove (blocked if findings still reference it). New AI tools appear constantly — early curation is intentional.

**4. Close blind spots — Coverage**  
List unmonitored devices with human-readable reasons. Uncovered devices are reportable facts, not settings details.

### How the screens relate

```
Overview ──coverage banner──► Coverage
    │
    ▼
Findings ◄── tool approval ──► Approved tools registry
    │                            (same ai_tools rows)
    └── detail: domain, confidence, coverage note
```

- Overview and Coverage share the same “devices not monitored” truth.  
- Findings are monitoring truth; Tools are policy — kept separate on purpose.  
- Coverage gaps are reported separately; unmonitored devices are not pretended to have findings.

### Running the prototype locally

```bash
# Install
npm install

# Configure DATABASE_URL in .env, then:
npm run db:push
npm run db:seed

# Dev server
npm run dev
```

Useful scripts: `db:generate`, `db:push`, `db:studio`, `db:seed`.

### Prototype limits (by design)

| In scope | Out of scope (this build) |
|----------|---------------------------|
| Domain / volume findings UI | Live packet / SNI collectors |
| Confidence-aware triage | Prompt or payload inspection |
| Tools registry CRUD | Traffic block / enforce |
| Coverage gap reporting | Production auth / multi-tenant ops |
| Sample seeded data | Full enterprise gateway |

---

## Summary

| | |
|--|--|
| **What** | Operator console for domain-level AI usage: findings, approved-tools policy, and coverage gaps |
| **Why** | Shadow AI is invisible and privacy-heavy to inspect; teams need honest volume signals and blind-spot reporting without reading prompts |
| **How** | Proxy/SNI-style signals → aggregated findings in Postgres → Next.js console; monitoring and policy stay separate; coverage gaps are first-class |
