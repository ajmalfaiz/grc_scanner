import type {
  MongoConnectionValues,
  MongoScopeValues,
} from "@/lib/discovery/mongodb/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function validateMongoConnectionValues(
  values: Record<string, string>,
): MongoConnectionValues {
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const database = requireTrimmed(values, "database");
  const port = (values.port ?? "27017").trim() || "27017";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }

  return {
    host,
    port,
    database,
    username,
    password: values.password ?? "",
    authSource: (values.authSource ?? "admin").trim() || "admin",
    tls: values.tls === "false" ? "false" : "true",
  };
}

export function normalizeMongoScopeValues(
  values: Record<string, string>,
): MongoScopeValues {
  return {
    coverageMode: values.coverageMode ?? "sample",
    collectionPattern: values.collectionPattern,
    nameTriage: values.nameTriage ?? "heuristics_llm",
    samplingRate: values.samplingRate ?? "1",
    samplingRateFull: values.samplingRateFull ?? "100",
    maxDepth: values.maxDepth ?? "3",
  };
}

/** Comma-separated glob patterns (`customers*`, `kyc*`) → a matcher. */
export function buildCollectionMatcher(
  pattern: string | undefined,
): (name: string) => boolean {
  const raw = (pattern ?? "").trim();
  if (!raw) return () => true;
  const globs = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i"));
  return (name: string) => globs.some((re) => re.test(name));
}

export function resolveMaxDepth(raw: string | undefined): number {
  if (raw === "unlimited") return 20;
  const n = Number.parseInt(raw ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 3;
}
