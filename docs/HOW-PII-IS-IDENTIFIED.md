# How PII Scanning Works

This document explains how Jethur Discovery identifies PII: the end-to-end scan flow, how metadata and content evidence are combined, how confidence is assigned, and what is (and is not) stored.

> **Current scope:** Live scanning is implemented for **Postgres**. Other connector screens may show connector-specific modeled results until their live adapters are wired.
>
> **Scanner / detector versions:** `discovery-postgres-5` / `openredaction-1`

---

## Executive summary

Jethur finds PII by combining two independent signals:

1. **Metadata name triage** — schema, table, and column names (plus data types) that look like PII fields
2. **Bounded content sampling** — a capped sample of row values inspected locally with [OpenRedaction](https://www.npmjs.com/package/openredaction) (in-process, no network)

When both agree, the finding is stronger. The product stores and displays **PII type, location, evidence summaries, counts, confidence, and coverage** — never raw sampled cell values.

---

## What a finding answers

Each finding answers five questions:

| Question | Example |
| --- | --- |
| What type of PII? | Email, Aadhaar, PAN, Phone number, UPI ID |
| Where? | `public.customers.email` or, in multi-DB scans, `appdb.hr.employees.aadhaar_number` |
| How detected? | Name triage, content sample, or name + content |
| How confident? | `high` or `medium` |
| How complete was the scan? | Coverage summary + coverage issues (skipped, capped, permission denied, …) |

---

## End-to-end scan flow

```
Connect → resolve databases → catalog tables/columns
       → name triage (± optional Gemini on metadata only)
       → select columns to sample
       → sample rows (capped)
       → OpenRedaction on sampled values
       → merge name + content evidence
       → return findings + coverage (no raw values)
```

### 1. Connect and choose scope

The browser posts connection details and scope to `/api/discovery/postgres/scan`.

**Connection**

- Required: host, port, username (password may be empty for trust/peer auth)
- Database selection: one database, several selected databases, or all discoverable databases
- SSL mode defaults to `prefer`

**Scope options** (normalized before scanning)

| Option | Default | Meaning |
| --- | --- | --- |
| `coverageMode` | `sample` | `sample` or `full` (deep) |
| `schemas` | _(all)_ | Optional comma-separated schema allowlist |
| `excludeSystemSchemas` | `yes` | Skip `pg_catalog`, `information_schema`, `pg_toast` |
| `nameTriage` | `heuristics` | `heuristics` or `heuristics_llm` |
| `samplingRate` | `1` | Percent of rows for sampled scans |
| `samplingRateFull` | `100` | Percent of rows for deep scans |
| `sampleMethod` | `random` | `random` or systematic stride |
| `contentTargets` | `ranked_plus_freetext` | Which columns get content inspection |

### 2. Resolve databases to scan

The scanner resolves which Postgres databases are in scope (selected list or discovered “all”), then scans each in turn. A shared **table budget of 100 tables** applies across all databases so multi-DB runs stay bounded.

When more than one database is scanned, finding locations are prefixed with the database name (`database.schema.table.column`).

### 3. Catalog metadata

For each database, the scanner reads `information_schema` / `pg_class` and catalogs:

- schemas, tables, columns
- data types and UDT names
- estimated row counts

System schemas are skipped by default. Catalog size is capped (remaining share of the 100-table budget).

### 4. Metadata name triage

Every cataloged column is checked against local heuristic rules. Rules use:

- **positive** name patterns (e.g. `email`, `aadhaar`, `pan_number`)
- optional **schema/table context** (e.g. KYC / payment tables)
- optional **data-type** constraints
- **negative** patterns to cut false positives (e.g. PAN rule excludes `span`, `panel`, `campaign`)

Example name → type mappings:

| Name signals | PII type |
| --- | --- |
| `email`, `work_email`, `mail_id` | Email |
| `phone`, `mobile`, `contact_number` | Phone number |
| `aadhaar`, `aadhar`, `uidai`, `national_id` | Aadhaar |
| `pan`, `pan_number`, `tax_id` | PAN |
| `gstin`, `gst_number` | GSTIN |
| `ifsc`, `upi`, `vpa` | IFSC / UPI ID |
| `passport`, `voter` / `epic`, driving licence | Gov IDs |
| `full_name`, `first_name`, … | Person name |
| `dob`, `date_of_birth` | Date of birth |
| `address`, `postal_code`, `pin_code` | Address / Indian pincode |
| `customer_id`, `employee_id` | Internal identifiers |

This step is fast and privacy-preserving: it never reads row values.

### 5. Optional LLM assist (metadata only)

If `nameTriage` is `heuristics_llm`, Gemini (`gemini-1.5-flash`) may classify ambiguous columns.

Guardrails:

- Input is **metadata only**: schema, table, column name, data type, UDT
- **Never** receives sampled cell values
- Must return structured JSON with allowed confidence (`high` / `medium`) and PII categories
- Results are **merged** with heuristics, not a replacement
- If Gemini is unavailable, the scan continues on heuristics alone

### 6. Select columns for content sampling

| `contentTargets` | Behavior |
| --- | --- |
| `ranked_only` | Only columns already flagged by name triage |
| `ranked_plus_freetext` (**default**) | Ranked columns + free-text / JSON canaries (`text`, `varchar`, `json`, `jsonb`, `citext`) |
| `all_columns` | Every column in scoped tables |

The default catches obvious PII columns and values hidden in notes, payloads, or JSON.

### 7. Sample rows (bounded in sample mode)

Per table:

- Rate comes from `samplingRate` (sample mode) or `samplingRateFull` (deep mode)
- **Sampled scan** hard cap: **200 rows per table**
- **Deep scan** (`coverageMode: full`): no hard row cap — the selected rate is honored (100% reads the full table)
- Random sampling prefers `TABLESAMPLE SYSTEM`, with `ORDER BY random()` fallback
- Systematic sampling uses a stable row-number stride

Sampled mode is for discovery evidence without full export. Deep mode trades time for fuller coverage.

### 8. Content detection with OpenRedaction

Sampled values are converted to text (objects → JSON) and inspected **in-process** with OpenRedaction. No raw matched substrings are returned to the product layer.

Mapped / emphasized types include:

- Email
- Phone (UK / US / international variants)
- Credit card, IBAN, IFSC
- Indian Aadhaar
- Person name, physical address
- IPv4 / IPv6
- US SSN, US ZIP

Unmapped OpenRedaction types may still surface as humanized labels under a `free_text` category. Gaming handles, crypto addresses, and similar noise types are ignored.

India-specific types such as **PAN, GSTIN, UPI, Passport, Voter ID** are primarily surfaced via **name triage** today; content confirmation depends on what OpenRedaction detects in the sample.

### 9. Merge evidence into findings

Hits are keyed by **location + PII type** so one column does not produce duplicate rows for the same type.

| Evidence present | `detectedVia` |
| --- | --- |
| Name only | `name_triage` |
| Content only | `content_sample` |
| Both | `both` |

Findings are sorted high-confidence first, then by location.

### 10. Return result payload

The API returns:

- `scanRun` — id, connector, timestamps, scanner/detector versions, mode
- `scopeLabel` / `scopeValue` — tables catalogued (and database note)
- `findings` — review list
- `coverage` / `coverageIssues` / `coverageLine` — completeness
- `methodNote` — human-readable process summary

Example method note shape:

`Catalogued columns → name triage (heuristics only) → 1% row sample → OpenRedaction (in-process). Types only; no cell values stored.`

---

## What “Detected via” means

### Name triage

Metadata alone suggested PII (e.g. column `employee_aadhaar`). Fast and low-risk; less certain when names are ambiguous.

### Content sample

Sampled values matched OpenRedaction. Useful when names are generic (`notes`, `payload`, `metadata`).

### Name + content

Both layers agree. Strongest path when content agreement is meaningful (see confidence rules below).

---

## How confidence is assigned

Confidence is only `high` or `medium`.

| Path | High when… | Otherwise |
| --- | --- | --- |
| **both** | Checksum-style validator present, **or** match rate ≥ 20% and ≥ 2 matched records | `medium` |
| **name_triage** | Confidence from the heuristic rule or LLM hit | — |
| **content_sample** | Checksum-style validator present, **or** ≥ 3 matched records and match rate ≥ 20% | `medium` |

OpenRedaction currently reports validators like `openredaction` and `confidence_NN` (score band). Checksum-backed promotion applies when a validator name matches `/checksum|verhoeff/i`.

**Medium** means “useful, review carefully” — not “wrong.”

---

## Risk level

Derived from PII category (not from confidence):

| Risk | Categories |
| --- | --- |
| High | `government_id`, `direct_identifier` |
| Medium | `financial`, `contact`, `demographic` |
| Low | `location`, `network`, `free_text`, `internal_identifier` |

---

## Coverage reporting

Coverage is separate from findings so “no finding” is not confused with “not scanned.”

Tracked:

- assets discovered / scanned / skipped / partial / capped
- fields scanned, sampled records, matched records
- `rawValuesStored: false`

Coverage issues include reasons such as:

- no columns matched content target selection
- sample capped at 200 rows (sampled mode only)
- catalog limited to first N tables (per DB or across DBs)
- permission denied / query failed / database scan failed

---

## Privacy and safety

- Raw sampled values are **not** stored on findings (`evidence.rawValuesStored` is always `false`)
- UI shows type, location, confidence, evidence summaries, and coverage — not cell contents
- LLM assist receives metadata only
- OpenRedaction runs in-process with audit/metrics logging disabled
- Connection secrets are persisted only if the user explicitly opts in to save them

---

## Limitations

- Sampling can miss rare values not present in the sample
- Misleading column names can produce metadata false positives
- Content detection coverage depends on OpenRedaction’s pattern set
- Permission and catalog caps create blind spots (reported as coverage issues)
- Discovery identifies **likely** PII locations; it is not legal classification or data-owner sign-off

---

## One-line summary

Jethur identifies PII by combining metadata name triage, optional metadata-only LLM assist, bounded row sampling, in-process OpenRedaction detection, and transparent coverage reporting — storing evidence summaries instead of raw personal data.

---

## Related

- [Scanning workflow](./SCANNING-WORKFLOW.md) — result segregation, UI presentation, and saved-result behavior
