import type {
  SaasAuthType,
  SaasConnectionValues,
  SaasScopeValues,
} from "@/lib/discovery/saas/types";
import { MAX_RESOURCES } from "@/lib/discovery/saas/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

/** `name:/path` per line, or a bare path (name derived from the last segment). */
export function parseResourceList(
  raw: string | undefined,
): Array<{ name: string; path: string }> {
  const lines = (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const resources: Array<{ name: string; path: string }> = [];
  for (const line of lines.slice(0, MAX_RESOURCES)) {
    const idx = line.indexOf(":");
    // Absolute URLs contain "://" — only treat the colon as a name separator
    // when it appears before any slash.
    const slashIdx = line.indexOf("/");
    const isNameSeparator = idx > 0 && (slashIdx === -1 || idx < slashIdx);
    if (isNameSeparator) {
      const name = line.slice(0, idx).trim();
      const path = line.slice(idx + 1).trim();
      if (name && path) resources.push({ name, path });
      continue;
    }
    const path = line;
    const name = path.split("/").filter(Boolean).pop() ?? path;
    resources.push({ name, path });
  }
  return resources;
}

export function parseExtraHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name && value) headers[name] = value;
  }
  return headers;
}

export function validateSaasConnectionValues(
  values: Record<string, string>,
): SaasConnectionValues {
  const baseUrlRaw = requireTrimmed(values, "baseUrl");
  let baseUrl: string;
  try {
    baseUrl = new URL(baseUrlRaw).toString().replace(/\/+$/, "");
  } catch {
    throw new Error("Invalid baseUrl — must be a full URL, e.g. https://api.example.com");
  }

  const authTypeRaw = (values.authType ?? "bearer").trim();
  const authType: SaasAuthType = (
    ["bearer", "api_key", "basic", "oauth2_client_credentials", "none"].includes(authTypeRaw)
      ? authTypeRaw
      : "bearer"
  ) as SaasAuthType;

  if (authType === "bearer" && !(values.bearerToken ?? "").trim()) {
    throw new Error("bearerToken is required for bearer auth");
  }
  if (authType === "api_key" && !(values.apiKeyValue ?? "").trim()) {
    throw new Error("apiKeyValue is required for API key auth");
  }
  if (authType === "basic" && !(values.basicUsername ?? "").trim()) {
    throw new Error("basicUsername is required for basic auth");
  }
  if (authType === "oauth2_client_credentials") {
    if (!(values.tokenUrl ?? "").trim()) {
      throw new Error("tokenUrl is required for OAuth2 client-credentials auth");
    }
    try {
      new URL(values.tokenUrl!.trim());
    } catch {
      throw new Error("Invalid tokenUrl — must be a full URL");
    }
    if (!(values.clientId ?? "").trim()) {
      throw new Error("clientId is required for OAuth2 client-credentials auth");
    }
    if (!(values.clientSecret ?? "").trim()) {
      throw new Error("clientSecret is required for OAuth2 client-credentials auth");
    }
  }

  const resources = parseResourceList(values.resources);
  if (resources.length === 0) {
    throw new Error("resources is required — list at least one resource path");
  }

  return {
    baseUrl,
    authType,
    bearerToken: values.bearerToken?.trim() || undefined,
    apiKeyHeader: values.apiKeyHeader?.trim() || "X-API-Key",
    apiKeyValue: values.apiKeyValue?.trim() || undefined,
    basicUsername: values.basicUsername?.trim() || undefined,
    basicPassword: values.basicPassword ?? undefined,
    tokenUrl: values.tokenUrl?.trim() || undefined,
    clientId: values.clientId?.trim() || undefined,
    clientSecret: values.clientSecret ?? undefined,
    oauthScope: values.oauthScope?.trim() || undefined,
    extraHeaders: values.extraHeaders,
    resources,
  };
}

export function normalizeSaasScopeValues(
  values: Record<string, string>,
): SaasScopeValues {
  const paginationRaw = values.pagination;
  const pagination =
    paginationRaw === "none" || paginationRaw === "cursor" ? paginationRaw : "page_param";
  return {
    coverageMode: values.coverageMode ?? "sample",
    resultsPath: values.resultsPath?.trim() || undefined,
    pagination,
    pageParam: values.pageParam?.trim() || "page",
    pageStart: values.pageStart?.trim() || "1",
    cursorParam: values.cursorParam?.trim() || "cursor",
    cursorPath: values.cursorPath?.trim() || undefined,
    maxPages: values.maxPages ?? "5",
    maxObjectsPerResource: values.maxObjectsPerResource ?? "500",
    nameTriage: values.nameTriage ?? "heuristics_llm",
    maxDepth: values.maxDepth ?? "3",
  };
}

/** Synchronous auth headers — everything except OAuth2, which needs a network round trip. */
export function buildAuthHeaders(connection: SaasConnectionValues): Record<string, string> {
  const headers: Record<string, string> = {};
  if (connection.authType === "bearer" && connection.bearerToken) {
    headers.Authorization = `Bearer ${connection.bearerToken}`;
  } else if (connection.authType === "api_key" && connection.apiKeyValue) {
    headers[connection.apiKeyHeader || "X-API-Key"] = connection.apiKeyValue;
  } else if (connection.authType === "basic" && connection.basicUsername) {
    const raw = `${connection.basicUsername}:${connection.basicPassword ?? ""}`;
    headers.Authorization = `Basic ${Buffer.from(raw).toString("base64")}`;
  }
  return { ...headers, ...parseExtraHeaders(connection.extraHeaders) };
}
