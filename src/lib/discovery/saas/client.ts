import { buildAuthHeaders } from "@/lib/discovery/saas/connection-values";
import type { SaasConnectionValues, SaasScopeValues } from "@/lib/discovery/saas/types";
import { REQUEST_TIMEOUT_MS } from "@/lib/discovery/saas/types";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.max(0, Math.min(date - Date.now(), MAX_BACKOFF_MS));
    }
  }
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

/**
 * Fetch with a timeout and rate-limit-aware retries: HTTP 429 and 5xx are
 * retried with exponential backoff (honoring `Retry-After` when present) up
 * to `MAX_RETRIES` times before giving up.
 */
async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  init?: { method?: string; body?: string },
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: init?.method,
        body: init?.body,
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
      });
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        lastResponse = response;
        await sleep(retryDelayMs(response, attempt));
        continue;
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Unreachable in practice — the loop always returns or retries — but
  // satisfies the type checker and covers a defensive fallback.
  return lastResponse!;
}

function readAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, value);
}

const ARRAY_KEYS = ["data", "results", "items", "records", "objects", "value", "content"];

/** Best-effort: find the array of records in an arbitrary JSON API response. */
export function extractRecords(json: unknown, resultsPath?: string): unknown[] {
  if (resultsPath) {
    const at = readAtPath(json, resultsPath);
    if (Array.isArray(at)) return at;
  }
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const key of ARRAY_KEYS) {
      const candidate = (json as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) return candidate;
    }
    // Single-object response (e.g. a "get one" endpoint) — treat as one record.
    return [json];
  }
  return [];
}

const CURSOR_KEYS = [
  "next_cursor",
  "nextCursor",
  "next_page_token",
  "nextPageToken",
  "cursor",
  "next",
];
const CURSOR_WRAPPER_KEYS = ["meta", "pagination", "paging", "page_info", "pageInfo"];

/** Best-effort: find the next-page cursor value in an arbitrary JSON API response. */
export function extractCursor(json: unknown, cursorPath?: string): string | undefined {
  if (cursorPath) {
    const at = readAtPath(json, cursorPath);
    if (typeof at === "string" && at) return at;
    if (typeof at === "number") return String(at);
    return undefined;
  }
  if (!json || typeof json !== "object") return undefined;
  const obj = json as Record<string, unknown>;

  for (const key of CURSOR_KEYS) {
    const value = obj[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  for (const wrapperKey of CURSOR_WRAPPER_KEYS) {
    const wrapper = obj[wrapperKey];
    if (!wrapper || typeof wrapper !== "object") continue;
    for (const key of CURSOR_KEYS) {
      const value = (wrapper as Record<string, unknown>)[key];
      if (typeof value === "string" && value) return value;
      if (typeof value === "number") return String(value);
    }
  }
  return undefined;
}

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

function tokenCacheKey(connection: SaasConnectionValues): string {
  return `${connection.tokenUrl}::${connection.clientId}`;
}

/** OAuth2 client-credentials grant — fetches (and briefly caches) a bearer token. */
async function fetchOAuth2Token(connection: SaasConnectionValues): Promise<string> {
  const key = tokenCacheKey(connection);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 5_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: connection.clientId ?? "",
    client_secret: connection.clientSecret ?? "",
    ...(connection.oauthScope ? { scope: connection.oauthScope } : {}),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(connection.tokenUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "AbortError"
        ? "OAuth2 token request timed out — check the token URL"
        : "Could not reach the OAuth2 token URL",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`OAuth2 token request failed — HTTP ${response.status}`);
  }

  const json = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!json?.access_token) {
    throw new Error("OAuth2 token response did not include access_token");
  }

  const expiresInSeconds = typeof json.expires_in === "number" ? json.expires_in : 3_600;
  const token = json.access_token;
  tokenCache.set(key, { token, expiresAt: Date.now() + expiresInSeconds * 1000 });
  return token;
}

/**
 * Resolve auth headers for a scan run. Synchronous auth types resolve
 * instantly; OAuth2 client-credentials fetches (or reuses a cached) token.
 * Call once per scan and reuse across all resource fetches.
 */
export async function resolveAuthHeaders(
  connection: SaasConnectionValues,
): Promise<Record<string, string>> {
  if (connection.authType === "oauth2_client_credentials") {
    const token = await fetchOAuth2Token(connection);
    return { Authorization: `Bearer ${token}`, ...buildAuthHeaders({ ...connection, authType: "none" }) };
  }
  return buildAuthHeaders(connection);
}

export type FetchResourceResult = {
  records: Record<string, unknown>[];
  pagesFetched: number;
  error?: string;
};

export async function fetchResourceRecords(
  connection: SaasConnectionValues,
  resourcePath: string,
  scope: SaasScopeValues,
  maxRecords: number,
  headers: Record<string, string>,
): Promise<FetchResourceResult> {
  const records: Record<string, unknown>[] = [];
  const maxPages =
    scope.pagination === "page_param" || scope.pagination === "cursor"
      ? Math.max(1, Number(scope.maxPages) || 1)
      : 1;
  const pageStart = Number(scope.pageStart) || 1;
  let cursor: string | undefined;

  for (let i = 0; i < maxPages; i += 1) {
    const url = new URL(
      resourcePath.startsWith("http") ? resourcePath : `${connection.baseUrl}${resourcePath}`,
    );
    if (scope.pagination === "page_param") {
      url.searchParams.set(scope.pageParam, String(pageStart + i));
    } else if (scope.pagination === "cursor" && cursor) {
      url.searchParams.set(scope.cursorParam || "cursor", cursor);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(url.toString(), headers);
    } catch (error) {
      return {
        records,
        pagesFetched: i,
        error: error instanceof Error ? error.message : "request failed",
      };
    }

    if (!response.ok) {
      return {
        records,
        pagesFetched: i,
        error: `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { records, pagesFetched: i + 1, error: "Response was not valid JSON" };
    }

    const page = extractRecords(json, scope.resultsPath).filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object",
    );
    records.push(...page);

    if (page.length === 0 || records.length >= maxRecords) break;
    if (scope.pagination === "none") break;

    if (scope.pagination === "cursor") {
      cursor = extractCursor(json, scope.cursorPath);
      if (!cursor) break;
    }
  }

  return { records: records.slice(0, maxRecords), pagesFetched: Math.min(maxPages, records.length || 1) };
}

export async function testSaasConnection(
  connection: SaasConnectionValues,
): Promise<{ ok: true; message: string; details: Record<string, string> }> {
  const headers = await resolveAuthHeaders(connection);
  const probePath = connection.resources[0]?.path ?? "/";
  const url = probePath.startsWith("http") ? probePath : `${connection.baseUrl}${probePath}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, headers);
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out — check the base URL and network access"
        : "Could not reach the host — check the base URL and network access",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Authentication failed — check the token, API key, or credentials");
  }
  if (!response.ok) {
    throw new Error(`Reached the host but got HTTP ${response.status} — check the resource path`);
  }

  return {
    ok: true,
    message: `Connected to ${new URL(connection.baseUrl).host} (HTTP ${response.status} on ${probePath})`,
    details: { host: new URL(connection.baseUrl).host, probePath },
  };
}
