import { extensionOf } from "@/lib/discovery/file-server/connection-values";
import type {
  Confidence,
  FileEntry,
  FileServerScopeValues,
  PathTriageHit,
  PiiCategory,
} from "@/lib/discovery/file-server/types";

/** Document / export formats commonly used for structured data dumps. */
const OFFICE_TEXT = new Set([
  "csv",
  "tsv",
  "xlsx",
  "xls",
  "pdf",
  "docx",
  "txt",
  "md",
  "sql",
  "json",
  "jsonl",
  "ndjson",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "log",
  "eml",
  "rtf",
]);

const SPREADSHEETS = new Set(["csv", "tsv", "xlsx", "xls"]);

/**
 * Known text-like extensions. When scope is `all`, any non-unsupported
 * extension (including none) is treated as readable and text-sniffed.
 */
const ALL_READABLE = new Set([
  ...OFFICE_TEXT,
  "env",
  "ini",
  "conf",
  "cfg",
  "properties",
  "toml",
]);

const UNSUPPORTED = new Set([
  "zip",
  "7z",
  "rar",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "wav",
  "exe",
  "dll",
  "so",
  "bin",
  "dmg",
  "iso",
  "apk",
  "class",
  "o",
  "obj",
  "wasm",
  "pptx",
  "ppt",
  "odp",
]);

type PathRule = {
  piiType: string;
  confidence: Confidence;
  category: PiiCategory;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  scoreBoost?: number;
};

const PATH_RULES: PathRule[] = [
  {
    piiType: "Email",
    confidence: "medium",
    category: "contact",
    patterns: [/e[-_]?mail/i, /mail[_-]?list/i, /contact/i],
  },
  {
    piiType: "Phone number",
    confidence: "medium",
    category: "contact",
    patterns: [/phone/i, /mobile/i, /contact[_-]?number/i],
  },
  {
    piiType: "Aadhaar",
    confidence: "high",
    category: "government_id",
    patterns: [/aadhaar/i, /aadhar/i, /uidai/i],
    scoreBoost: 20,
  },
  {
    piiType: "PAN",
    confidence: "high",
    category: "government_id",
    patterns: [/\bpan\b/i, /pan[_-]?(number|no|card|list)/i],
    negativePatterns: [/span/i, /panel/i, /campaign/i],
    scoreBoost: 20,
  },
  {
    piiType: "Bank account number",
    confidence: "medium",
    category: "financial",
    patterns: [/bank/i, /account/i, /iban/i, /payroll/i, /vendor/i],
  },
  {
    piiType: "Passport number",
    confidence: "high",
    category: "government_id",
    patterns: [/passport/i],
    scoreBoost: 15,
  },
  {
    piiType: "SSN",
    confidence: "high",
    category: "government_id",
    patterns: [/\bssn\b/i, /social[_-]?security/i],
    scoreBoost: 20,
  },
  {
    piiType: "Person name",
    confidence: "medium",
    category: "direct_identifier",
    patterns: [/employee/i, /staff/i, /customer/i, /contractor/i, /onboarding/i],
  },
  {
    piiType: "Physical address",
    confidence: "medium",
    category: "location",
    patterns: [/address/i, /postal/i],
  },
  {
    piiType: "Employee ID",
    confidence: "medium",
    category: "internal_identifier",
    patterns: [/employee[_-]?id/i, /emp[_-]?(id|code|master)/i],
  },
  {
    piiType: "Customer ID",
    confidence: "medium",
    category: "internal_identifier",
    patterns: [/customer[_-]?id/i, /client[_-]?id/i],
  },
];

export function allowlistForFileTypes(
  fileTypes: FileServerScopeValues["fileTypes"],
): Set<string> {
  if (fileTypes === "spreadsheets") return SPREADSHEETS;
  if (fileTypes === "all") return ALL_READABLE;
  return OFFICE_TEXT;
}

export function isUnsupportedExtension(ext: string): boolean {
  return UNSUPPORTED.has(ext);
}

export function isReadableExtension(
  ext: string,
  fileTypes: FileServerScopeValues["fileTypes"],
): boolean {
  // Broadest mode: attempt every file that is not explicitly unsupported.
  // Binary / non-text content is rejected later during extraction.
  if (fileTypes === "all") {
    return !isUnsupportedExtension(ext);
  }
  return allowlistForFileTypes(fileTypes).has(ext);
}

export function triageFilePath(file: FileEntry): PathTriageHit[] {
  const blob = `${file.path} ${file.name}`;
  const hits: PathTriageHit[] = [];

  for (const rule of PATH_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(blob))) continue;
    if (rule.negativePatterns?.some((pattern) => pattern.test(blob))) continue;
    const score =
      50 +
      (rule.confidence === "high" ? 20 : 0) +
      (rule.scoreBoost ?? 0);
    hits.push({
      path: file.path,
      piiType: rule.piiType,
      confidence: rule.confidence,
      category: rule.category,
      score,
      signals: ["metadata_name"],
      reasons: [`Path or filename matched ${rule.piiType}`],
    });
  }

  return hits;
}

export function triageInventory(files: FileEntry[]): PathTriageHit[] {
  return files.flatMap(triageFilePath);
}

export function pathTriageScore(
  file: FileEntry,
  hits: PathTriageHit[],
): number {
  return hits
    .filter((hit) => hit.path === file.path)
    .reduce((max, hit) => Math.max(max, hit.score), 0);
}

export type TriageDecision =
  | { status: "eligible"; file: FileEntry }
  | { status: "unsupported"; file: FileEntry; reason: string }
  | { status: "skipped"; file: FileEntry; reason: string }
  | { status: "oversized"; file: FileEntry; reason: string };

export function classifyFile(
  file: FileEntry,
  scope: FileServerScopeValues,
): TriageDecision {
  const ext = file.ext || extensionOf(file.name);
  const maxBytes = Number(scope.maxFileSizeMb) * 1024 * 1024;

  if (isUnsupportedExtension(ext)) {
    return {
      status: "unsupported",
      file,
      reason: `Unsupported file type (.${ext || "unknown"})`,
    };
  }

  if (!isReadableExtension(ext, scope.fileTypes)) {
    return {
      status: "skipped",
      file,
      reason: `File type .${ext || "unknown"} excluded by scope`,
    };
  }

  if (file.size > maxBytes) {
    return {
      status: "oversized",
      file,
      reason: `File exceeds ${scope.maxFileSizeMb} MB size limit`,
    };
  }

  return { status: "eligible", file };
}

/**
 * Generic variant of {@link classifyFile} for connectors that decide
 * readability by their own extension allowlist (server logs/configs,
 * backup archive members) rather than the file-server `fileTypes` enum.
 */
export function classifyFileByAllowlist(
  file: FileEntry,
  opts: { maxFileSizeMb: string; isAllowed: (ext: string) => boolean },
): TriageDecision {
  const ext = file.ext || extensionOf(file.name);
  const maxBytes = Number(opts.maxFileSizeMb) * 1024 * 1024;

  if (isUnsupportedExtension(ext)) {
    return {
      status: "unsupported",
      file,
      reason: `Unsupported file type (.${ext || "unknown"})`,
    };
  }

  if (!opts.isAllowed(ext)) {
    return {
      status: "skipped",
      file,
      reason: `File type .${ext || "unknown"} excluded by scope`,
    };
  }

  if (file.size > maxBytes) {
    return {
      status: "oversized",
      file,
      reason: `File exceeds ${opts.maxFileSizeMb} MB size limit`,
    };
  }

  return { status: "eligible", file };
}

/** Generic variant of {@link selectFilesForContent} without the fileTypes enum. */
export function selectFilesGeneric(
  eligible: FileEntry[],
  hits: PathTriageHit[],
  opts: {
    coverageMode: "sample" | "full";
    maxFiles?: string;
    prefer?: "recent" | "random";
  },
): FileEntry[] {
  const ranked = [...eligible].sort((a, b) => {
    const scoreDiff = pathTriageScore(b, hits) - pathTriageScore(a, hits);
    if (scoreDiff !== 0) return scoreDiff;
    if (opts.prefer === "recent") {
      return b.mtimeMs - a.mtimeMs;
    }
    return 0;
  });

  if (opts.prefer === "random") {
    for (let i = ranked.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const scoreI = pathTriageScore(ranked[i], hits);
      const scoreJ = pathTriageScore(ranked[j], hits);
      if (scoreI === scoreJ) {
        [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
      }
    }
  }

  if (opts.coverageMode === "full") {
    return ranked;
  }

  const limit = Number(opts.maxFiles ?? "200");
  return ranked.slice(0, Math.max(1, limit));
}

export function selectFilesForContent(
  eligible: FileEntry[],
  hits: PathTriageHit[],
  scope: FileServerScopeValues,
): FileEntry[] {
  const ranked = [...eligible].sort((a, b) => {
    const scoreDiff = pathTriageScore(b, hits) - pathTriageScore(a, hits);
    if (scoreDiff !== 0) return scoreDiff;
    if (scope.prefer === "recent") {
      return b.mtimeMs - a.mtimeMs;
    }
    return 0;
  });

  if (scope.prefer === "random") {
    // Stable-ish shuffle after triage score buckets: shuffle within equal scores.
    for (let i = ranked.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const scoreI = pathTriageScore(ranked[i], hits);
      const scoreJ = pathTriageScore(ranked[j], hits);
      if (scoreI === scoreJ) {
        [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
      }
    }
  }

  if (scope.coverageMode === "full") {
    return ranked;
  }

  const limit = Number(scope.maxFiles);
  return ranked.slice(0, Math.max(1, limit));
}
