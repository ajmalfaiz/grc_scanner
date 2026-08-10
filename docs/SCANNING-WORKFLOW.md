# Jethur Discovery Scanning Workflow

Companion to [How PII Is Identified](./HOW-PII-IS-IDENTIFIED.md). This document focuses on how the scan result is shaped, segregated for review, and shown in the UI.

> **Current scope:** Live scanning is implemented for **all eight connectors** — Postgres, MySQL, MongoDB, File server (SMB/SFTP), Server (SSH log/config), SaaS (generic REST API), Email (IMAP), and Backups & archives (zip). No connector shows mock or modeled results; every scan result comes from a real connection.
>
> For detection mechanics (name triage, OpenRedaction, confidence rules), use the PII identification doc.

---

## Purpose

The scanner answers four questions:

1. What assets are in scope?
2. Which fields likely contain personal or sensitive data?
3. How strong is the evidence for each finding?
4. Which assets were not fully scanned, and why?

Output stores types, locations, metadata, counts, and evidence summaries — **not** raw sampled cell values.

---

## API flow (Postgres)

1. Browser sends connection + scope to `/api/discovery/postgres/scan`
2. API validates auth and database selection, normalizes scope
3. Scanner resolves one or more databases, catalogs tables (shared 100-table budget), runs name triage, samples rows, runs OpenRedaction, merges findings
4. Response returns `scanRun`, findings, coverage, coverage issues, coverage line, and method note

Default scope highlights:

- `nameTriage`: `heuristics` (optional `heuristics_llm`)
- `contentTargets`: `ranked_plus_freetext`
- Sample mode rate `1%` with hard cap **200 rows/table**; deep mode rate defaults to `100%` with **no** hard row cap

---

## How results are segregated

### 1. Scan run metadata (`scanRun`)

- Unique scan ID, connector ID, start/end times
- `scannerVersion` / `detectorVersion` (currently `discovery-postgres-5` / `openredaction-1`)
- Scan mode (`sample` or `full`)

### 2. Scope summary

- `scopeLabel`: e.g. `Tables catalogued (mydb)` or `Tables catalogued (3 databases)`
- `scopeValue`: number of tables catalogued

### 3. Findings

One finding per **location + PII type**. Fields include:

- `location`, `piiType`, `confidence`, `detectedVia`
- `category`, `riskLevel`, `detectionSignals`
- `evidence` (counts, match rate, validators, reasons; `rawValuesStored: false`)
- `asset` / `field` metadata

Sorted: high confidence first, then location.

**Detected via**

| Value | Meaning |
| --- | --- |
| `name_triage` | Metadata only |
| `content_sample` | Sampled values only |
| `both` | Metadata and content agree |

**Confidence segregation**

- High-confidence findings listed first
- Medium counted as “Needs review” in the UI

**Category → risk**

- High: government ID, direct identifier
- Medium: financial, contact, demographic
- Low: location, network, free text, internal identifier

### 4. Coverage summary (`coverage`)

Discovered / scanned / skipped / partial / capped assets, fields scanned, sampled and matched records, `rawValuesStored: false`.

### 5. Coverage issues (`coverageIssues`)

Statuses such as `partial`, `skipped`, `permission_denied`, `timeout`, `unsupported`, `capped`, with asset, reason, and optional counts.

Examples: no content-target columns; sample capped at 200 (sampled mode); catalog limited to 100 tables; permission denied; per-database scan failure.

### 6. Coverage line (`coverageLine`)

Human-readable completeness summary shown near the findings list.

### 7. Method note (`methodNote`)

Auditable process string, e.g. triage mode (heuristics / Gemini / Gemini unavailable), sample rate, and OpenRedaction in-process detection.

---

## UI segregation

The saved connection workspace turns the latest scan payload into a display result:

- Header: connection + scope
- Method note
- Stat cards
- Virtualized findings table (location, PII type, detection method, confidence, match count/rate)
- Needs-review count
- Coverage quality + coverage gaps sheet
- Coverage line under the table

Findings and completeness stay separate so reviewers see both what was found and what was not fully scanned.

---

## Saved result behavior

On completion, the browser may cache the latest scan on the saved connection (local storage): metadata, findings, coverage, issues, coverage line, method note.

Secrets are handled separately:

- Passwords and tokens redacted by default
- Stored only when the user explicitly opts in
- Session drafts may keep secrets temporarily so a scan can run

---

## Why segregation helps

Reviewers get:

- High-confidence findings first
- Medium findings as an explicit review queue
- Visible detection method labels
- Category/risk for prioritization
- Coverage quality and reasoned gaps
- Auditable method notes
- No raw values in the persisted result

Detection evidence, confidence, risk, and coverage are related but not the same — keeping them separate makes results easier to trust and act on.
