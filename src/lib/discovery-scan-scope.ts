import type { ConnectorId } from "@/lib/discovery-mock-data";
import type { ConnectionField } from "@/lib/discovery-connection-fields";
import {
  areRequiredFieldsFilled,
  buildInitialValues,
  getVisibleFields,
} from "@/lib/discovery-connection-fields";

export type CoverageMode = "sample" | "full";

export type ScopeField = ConnectionField;

/** Fixed stages every real PII scanner needs — connector-aware copy. */
export type PipelineStage = {
  title: string;
  detail: string;
};

export const coverageModeOptions: {
  value: CoverageMode;
  label: string;
  description: string;
}[] = [
  {
    value: "sample",
    label: "Sampled scan",
    description:
      "Catalog + name triage, then row/doc samples at a set rate. Recommended first pass.",
  },
  {
    value: "full",
    label: "Deep scan",
    description:
      "Same pipeline with higher intensity — more rows and broader column coverage.",
  },
];

export const scanPipelineByConnector: Record<ConnectorId, PipelineStage[]> = {
  postgres: [
    {
      title: "1. Catalog",
      detail: "List schemas, tables, columns, and types (no row content).",
    },
    {
      title: "2. Name triage",
      detail:
        "Score columns with name/type heuristics; optional LLM assist on names only.",
    },
    {
      title: "3. Content sample",
      detail:
        "Draw rows at the sampling rate; run local PII detectors. Never show raw values.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and coverage gaps (e.g. permission denied).",
    },
  ],
  mysql: [
    {
      title: "1. Catalog",
      detail: "List databases, tables, columns, and types (no row content).",
    },
    {
      title: "2. Name triage",
      detail:
        "Score columns with name/type heuristics; optional LLM assist on names only.",
    },
    {
      title: "3. Content sample",
      detail:
        "Draw rows at the sampling rate; run local PII detectors. Never show raw values.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and coverage gaps.",
    },
  ],
  mongodb: [
    {
      title: "1. Catalog",
      detail: "List collections and sample document shapes (field paths).",
    },
    {
      title: "2. Field triage",
      detail: "Rank field paths by name heuristics (+ optional LLM on names).",
    },
    {
      title: "3. Content sample",
      detail: "Sample documents; detect PII locally on ranked fields.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and coverage gaps.",
    },
  ],
  "file-server": [
    {
      title: "1. Inventory",
      detail: "Walk share paths; record file names, sizes, and types.",
    },
    {
      title: "2. File triage",
      detail: "Prioritise readable office/text types under size limits.",
    },
    {
      title: "3. Content sample",
      detail: "Extract text from selected files; run local PII detectors.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and skipped/encrypted files.",
    },
  ],
  server: [
    {
      title: "1. Inventory",
      detail: "Enumerate paths (logs, configs) under SSH.",
    },
    {
      title: "2. File triage",
      detail: "Filter by extension; skip binaries where possible.",
    },
    {
      title: "3. Content sample",
      detail: "Read head/tail/window or full file; detect PII locally.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and permission gaps.",
    },
  ],
  saas: [
    {
      title: "1. Catalog",
      detail: "List object types and property schemas via API.",
    },
    {
      title: "2. Property triage",
      detail: "Rank standard + custom fields by name heuristics.",
    },
    {
      title: "3. Content sample",
      detail: "Pull object samples; detect PII locally on field values.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and API scope gaps.",
    },
  ],
  email: [
    {
      title: "1. Catalog",
      detail: "List configured mailboxes and message counts in scope.",
    },
    {
      title: "2. Message fetch",
      detail: "Fetch recent messages (subject, sender, body, attachments) via IMAP.",
    },
    {
      title: "3. Content sample",
      detail: "Run local PII detectors on message text and readable attachments.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and mailbox access gaps.",
    },
  ],
  backups: [
    {
      title: "1. Inventory",
      detail: "Walk the source path for backup archives (.zip).",
    },
    {
      title: "2. Archive triage",
      detail: "Filter by size; skip unreadable/encrypted archives.",
    },
    {
      title: "3. Content sample",
      detail: "Extract text from archive members; run local PII detectors.",
    },
    {
      title: "4. Report",
      detail: "PII type labels, confidence, and archive coverage gaps.",
    },
  ],
};

/**
 * Configurable knobs for the scanner.
 * Catalog + report stages are always on — not toggles.
 */
export const scopeFieldsByConnector: Record<ConnectorId, ScopeField[]> = {
  postgres: [
    {
      name: "schemas",
      label: "Schemas to include",
      type: "text",
      required: false,
      placeholder: "public, hr, finance",
      hint: "Comma-separated. Blank = all non-system schemas.",
      fullWidth: true,
    },
    {
      name: "excludeSystemSchemas",
      label: "Exclude system schemas",
      type: "select",
      required: true,
      defaultValue: "yes",
      options: [
        { value: "yes", label: "Yes (skip pg_catalog, information_schema)" },
        { value: "no", label: "No" },
      ],
      fullWidth: true,
    },
    {
      name: "nameTriage",
      label: "Column name triage",
      type: "select",
      required: true,
      defaultValue: "heuristics",
      options: [
        {
          value: "heuristics",
          label: "Heuristics only (on-system; name + type rules)",
        },
        {
          value: "heuristics_llm",
          label: "Heuristics + LLM assist (metadata only; requires opt-in)",
        },
      ],
      hint: "Default stays on-system. LLM assist needs DISCOVERY_ALLOW_EXTERNAL_LLM=true and never receives cell values.",
      fullWidth: true,
    },
    {
      name: "samplingRate",
      label: "Row sampling rate",
      type: "select",
      required: true,
      defaultValue: "1",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "0.1", label: "0.1% of rows per table" },
        { value: "1", label: "1% of rows per table" },
        { value: "5", label: "5% of rows per table" },
        { value: "10", label: "10% of rows per table" },
      ],
      hint: "Sample rows, then inspect ranked columns in those rows.",
    },
    {
      name: "samplingRateFull",
      label: "Row sampling rate",
      type: "select",
      required: true,
      defaultValue: "100",
      when: { field: "coverageMode", equals: "full" },
      options: [
        { value: "25", label: "25% of rows per table" },
        { value: "50", label: "50% of rows per table" },
        { value: "100", label: "100% of rows (deep)" },
      ],
    },
    {
      name: "sampleMethod",
      label: "Sample method",
      type: "select",
      required: true,
      defaultValue: "random",
      options: [
        { value: "random", label: "Random rows" },
        { value: "systematic", label: "Systematic (every Nth row)" },
      ],
    },
    {
      name: "contentTargets",
      label: "Content detection targets",
      type: "select",
      required: true,
      defaultValue: "ranked_plus_freetext",
      options: [
        {
          value: "ranked_only",
          label: "Ranked columns only (after name triage)",
        },
        {
          value: "ranked_plus_freetext",
          label: "Ranked + free-text / JSON canary columns",
        },
        {
          value: "all_columns",
          label: "All columns in sampled rows",
        },
      ],
      hint: "Free-text canaries catch PII hidden in notes/payload columns.",
      fullWidth: true,
    },
  ],

  mysql: [
    {
      name: "excludeSystemSchemas",
      label: "Exclude system schemas",
      type: "select",
      required: true,
      defaultValue: "yes",
      options: [
        { value: "yes", label: "Yes (skip mysql, information_schema, …)" },
        { value: "no", label: "No" },
      ],
      fullWidth: true,
    },
    {
      name: "nameTriage",
      label: "Column name triage",
      type: "select",
      required: true,
      defaultValue: "heuristics_llm",
      options: [
        {
          value: "heuristics",
          label: "Heuristics only (name + type rules)",
        },
        {
          value: "heuristics_llm",
          label: "Heuristics + LLM assist on column names",
        },
      ],
      hint: "LLM sees names/types only — never cell values.",
      fullWidth: true,
    },
    {
      name: "samplingRate",
      label: "Row sampling rate",
      type: "select",
      required: true,
      defaultValue: "1",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "0.1", label: "0.1% of rows per table" },
        { value: "1", label: "1% of rows per table" },
        { value: "5", label: "5% of rows per table" },
        { value: "10", label: "10% of rows per table" },
      ],
    },
    {
      name: "samplingRateFull",
      label: "Row sampling rate",
      type: "select",
      required: true,
      defaultValue: "100",
      when: { field: "coverageMode", equals: "full" },
      options: [
        { value: "25", label: "25% of rows per table" },
        { value: "50", label: "50% of rows per table" },
        { value: "100", label: "100% of rows (deep)" },
      ],
    },
    {
      name: "sampleMethod",
      label: "Sample method",
      type: "select",
      required: true,
      defaultValue: "random",
      options: [
        { value: "random", label: "Random rows" },
        { value: "systematic", label: "Systematic (every Nth row)" },
      ],
    },
    {
      name: "contentTargets",
      label: "Content detection targets",
      type: "select",
      required: true,
      defaultValue: "ranked_plus_freetext",
      options: [
        {
          value: "ranked_only",
          label: "Ranked columns only (after name triage)",
        },
        {
          value: "ranked_plus_freetext",
          label: "Ranked + free-text / JSON canary columns",
        },
        {
          value: "all_columns",
          label: "All columns in sampled rows",
        },
      ],
      fullWidth: true,
    },
  ],

  mongodb: [
    {
      name: "collectionPattern",
      label: "Collections include pattern",
      type: "text",
      required: false,
      placeholder: "customers*, kyc*",
      hint: "Glob-style. Blank = all collections.",
      fullWidth: true,
    },
    {
      name: "nameTriage",
      label: "Field name triage",
      type: "select",
      required: true,
      defaultValue: "heuristics_llm",
      options: [
        { value: "heuristics", label: "Heuristics only" },
        {
          value: "heuristics_llm",
          label: "Heuristics + LLM assist on field names",
        },
      ],
      fullWidth: true,
    },
    {
      name: "samplingRate",
      label: "Document sampling rate",
      type: "select",
      required: true,
      defaultValue: "1",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "0.1", label: "0.1% of documents" },
        { value: "1", label: "1% of documents" },
        { value: "5", label: "5% of documents" },
        { value: "10", label: "10% of documents" },
      ],
    },
    {
      name: "samplingRateFull",
      label: "Document sampling rate",
      type: "select",
      required: true,
      defaultValue: "100",
      when: { field: "coverageMode", equals: "full" },
      options: [
        { value: "25", label: "25% of documents" },
        { value: "50", label: "50% of documents" },
        { value: "100", label: "100% of documents (deep)" },
      ],
    },
    {
      name: "maxDepth",
      label: "Max nested field depth",
      type: "select",
      required: true,
      defaultValue: "3",
      options: [
        { value: "2", label: "2 levels" },
        { value: "3", label: "3 levels" },
        { value: "5", label: "5 levels" },
        { value: "unlimited", label: "Unlimited" },
      ],
      fullWidth: true,
    },
  ],

  "file-server": [
    {
      name: "fileTypes",
      label: "File types",
      type: "select",
      required: true,
      defaultValue: "all",
      options: [
        {
          value: "all",
          label: "All possible PII sources (recommended)",
        },
        {
          value: "office_text",
          label: "Documents & dumps (CSV, SQL, PDF, DOCX, JSON…)",
        },
        { value: "spreadsheets", label: "Spreadsheets only (CSV, XLSX)" },
      ],
      fullWidth: true,
      hint: "All mode tries every non-archive/non-media file as text so SQL dumps and unnamed exports are not skipped",
    },
    {
      name: "maxFileSizeMb",
      label: "Max file size (MB)",
      type: "select",
      required: true,
      defaultValue: "25",
      options: [
        { value: "5", label: "5 MB" },
        { value: "25", label: "25 MB" },
        { value: "100", label: "100 MB" },
      ],
    },
    {
      name: "maxFiles",
      label: "Max files (sample)",
      type: "select",
      required: true,
      defaultValue: "200",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "50", label: "50 files" },
        { value: "200", label: "200 files" },
        { value: "1000", label: "1,000 files" },
      ],
    },
    {
      name: "prefer",
      label: "Prefer",
      type: "select",
      required: true,
      defaultValue: "recent",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "recent", label: "Recently modified" },
        { value: "random", label: "Random sample" },
      ],
    },
  ],

  server: [
    {
      name: "extensions",
      label: "File extensions",
      type: "text",
      required: false,
      placeholder: "log, env, json, conf, yml",
      defaultValue: "log, env, json, conf, yml",
      hint: "Comma-separated. Blank = all files.",
      fullWidth: true,
    },
    {
      name: "recursive",
      label: "Recursive under paths",
      type: "select",
      required: true,
      defaultValue: "yes",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No — listed paths only" },
      ],
    },
    {
      name: "lineSample",
      label: "Line sampling",
      type: "select",
      required: true,
      defaultValue: "head_tail",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "head", label: "First 500 lines" },
        { value: "tail", label: "Last 500 lines" },
        { value: "head_tail", label: "First + last 250 lines" },
        { value: "random", label: "Random 500-line window" },
      ],
      fullWidth: true,
    },
  ],

  saas: [
    {
      name: "resultsPath",
      label: "Results path",
      type: "text",
      required: false,
      placeholder: "data.items",
      hint: "Dot path to the record array in each response. Blank = auto-detect (array, data, results, items, records, value)",
      fullWidth: true,
    },
    {
      name: "pagination",
      label: "Pagination",
      type: "select",
      required: true,
      defaultValue: "page_param",
      options: [
        { value: "page_param", label: "Page query parameter" },
        { value: "cursor", label: "Cursor / next-page token" },
        { value: "none", label: "None — single page per resource" },
      ],
      fullWidth: true,
    },
    {
      name: "pageParam",
      label: "Page parameter name",
      type: "text",
      required: false,
      defaultValue: "page",
      when: { field: "pagination", equals: "page_param" },
    },
    {
      name: "pageStart",
      label: "First page number",
      type: "text",
      required: false,
      defaultValue: "1",
      when: { field: "pagination", equals: "page_param" },
    },
    {
      name: "cursorParam",
      label: "Cursor parameter name",
      type: "text",
      required: false,
      defaultValue: "cursor",
      when: { field: "pagination", equals: "cursor" },
      hint: "Query param the next-page token is sent back as",
    },
    {
      name: "cursorPath",
      label: "Cursor path in response",
      type: "text",
      required: false,
      placeholder: "meta.next_cursor",
      when: { field: "pagination", equals: "cursor" },
      hint: "Dot path to the next-cursor value. Blank = auto-detect (next_cursor, nextPageToken, next, …)",
    },
    {
      name: "maxPages",
      label: "Max pages per resource",
      type: "select",
      required: true,
      defaultValue: "5",
      // `when` only supports one field/value pair, and this applies to both
      // page_param and cursor pagination — shown whenever pagination isn't
      // "none" is approximated by just always showing it (harmless no-op
      // when pagination is "none").
      options: [
        { value: "1", label: "1 page" },
        { value: "5", label: "5 pages" },
        { value: "20", label: "20 pages" },
      ],
    },
    {
      name: "nameTriage",
      label: "Field name triage",
      type: "select",
      required: true,
      defaultValue: "heuristics_llm",
      options: [
        { value: "heuristics", label: "Heuristics only" },
        { value: "heuristics_llm", label: "Heuristics + LLM assist on field names" },
      ],
      fullWidth: true,
    },
    {
      name: "maxDepth",
      label: "Max nested field depth",
      type: "select",
      required: true,
      defaultValue: "3",
      options: [
        { value: "2", label: "2 levels" },
        { value: "3", label: "3 levels" },
        { value: "5", label: "5 levels" },
        { value: "unlimited", label: "Unlimited" },
      ],
    },
    {
      name: "maxObjectsPerResource",
      label: "Objects per resource (sample)",
      type: "select",
      required: true,
      defaultValue: "500",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "100", label: "100 objects" },
        { value: "500", label: "500 objects" },
        { value: "5000", label: "5,000 objects" },
      ],
      fullWidth: true,
    },
  ],

  email: [
    {
      name: "lookbackDays",
      label: "Lookback window",
      type: "select",
      required: true,
      defaultValue: "90",
      options: [
        { value: "30", label: "Last 30 days" },
        { value: "90", label: "Last 90 days" },
        { value: "365", label: "Last year" },
        { value: "all", label: "All messages" },
      ],
      fullWidth: true,
    },
    {
      name: "maxMessagesPerMailbox",
      label: "Messages per mailbox (sample)",
      type: "select",
      required: true,
      defaultValue: "200",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "50", label: "50 messages" },
        { value: "200", label: "200 messages" },
        { value: "1000", label: "1,000 messages" },
      ],
    },
    {
      name: "includeAttachments",
      label: "Include attachment text",
      type: "select",
      required: true,
      defaultValue: "yes",
      options: [
        { value: "yes", label: "Yes — PDF, DOCX, XLSX, CSV, TXT" },
        { value: "no", label: "No — message text only" },
      ],
    },
  ],

  backups: [
    {
      name: "maxArchiveSizeMb",
      label: "Max archive size (MB)",
      type: "select",
      required: true,
      defaultValue: "100",
      options: [
        { value: "25", label: "25 MB" },
        { value: "100", label: "100 MB" },
        { value: "500", label: "500 MB" },
      ],
    },
    {
      name: "maxArchives",
      label: "Max archives (sample)",
      type: "select",
      required: true,
      defaultValue: "50",
      when: { field: "coverageMode", equals: "sample" },
      options: [
        { value: "20", label: "20 archives" },
        { value: "50", label: "50 archives" },
        { value: "200", label: "200 archives" },
      ],
    },
    {
      name: "maxEntriesPerArchive",
      label: "Max entries per archive",
      type: "select",
      required: true,
      defaultValue: "200",
      options: [
        { value: "50", label: "50 entries" },
        { value: "200", label: "200 entries" },
        { value: "1000", label: "1,000 entries" },
      ],
    },
  ],
};

export function getScanPipeline(connectorId: ConnectorId): PipelineStage[] {
  return scanPipelineByConnector[connectorId];
}

export function getScopeFields(connectorId: ConnectorId): ScopeField[] {
  return scopeFieldsByConnector[connectorId];
}

export function buildScopeInitialValues(
  connectorId: ConnectorId,
): Record<string, string> {
  return {
    coverageMode: "sample",
    ...buildInitialValues(getScopeFields(connectorId)),
  };
}

export function getVisibleScopeFields(
  connectorId: ConnectorId,
  values: Record<string, string>,
): ScopeField[] {
  return getVisibleFields(getScopeFields(connectorId), values);
}

export function isScopeReady(
  connectorId: ConnectorId,
  values: Record<string, string>,
): boolean {
  if (values.coverageMode !== "sample" && values.coverageMode !== "full") {
    return false;
  }
  return areRequiredFieldsFilled(getScopeFields(connectorId), values);
}
