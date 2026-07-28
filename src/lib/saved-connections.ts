import type {
  ConnectorId,
  CoverageIssue,
  CoverageSummary,
  Finding,
  ScanRunMetadata,
} from "@/lib/discovery-mock-data";
import { getScanResult } from "@/lib/discovery-mock-data";
import {
  getConnectionFields,
  getVisibleFields,
} from "@/lib/discovery-connection-fields";
import { normalizePostgresConnectionValues } from "@/lib/discovery/postgres/connection-values";

const SAVED_KEY = "jethur-discovery-saved-connections";
const DRAFT_KEY = "jethur-discovery-draft";

export const SECRET_FIELD_NAMES = new Set([
  "connectionString",
  "password",
  "privateKey",
  "passphrase",
  "accessToken",
  "clientSecret",
  "refreshToken",
]);

/** Latest scan payload cached on the saved connection (browser only). */
export type SavedScanResult = {
  scanRun?: ScanRunMetadata;
  scopeLabel: string;
  scopeValue: number;
  findings: Finding[];
  coverage?: CoverageSummary;
  coverageIssues?: CoverageIssue[];
  coverageLine: string;
  methodNote: string;
};

export type SavedConnection = {
  id: string;
  connectorId: ConnectorId;
  label: string;
  connectionSummary: string;
  scopeSummary: string;
  /**
   * When false (default), secrets are never persisted.
   * Only true after the user explicitly agrees to remember them.
   */
  storeSecrets: boolean;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  lastScanResult?: SavedScanResult;
  lastScannedAt: string;
  createdAt: string;
};

export type DiscoveryDraft = {
  connectorId: ConnectorId;
  savedId?: string;
  /** Opt-in to persist secrets when the connection is saved after scan. */
  storeSecrets?: boolean;
  connectionValues: Record<string, string>;
  scopeValues?: Record<string, string>;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function redactSecrets(
  values: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = SECRET_FIELD_NAMES.has(key) ? "" : value;
  }
  return next;
}

/** Persist secrets only when the user explicitly opted in. */
export function prepareConnectionValues(
  values: Record<string, string>,
  storeSecrets: boolean,
): Record<string, string> {
  return storeSecrets ? { ...values } : redactSecrets(values);
}

function normalizeConnectionValues(
  connectorId: ConnectorId,
  values: Record<string, string>,
): Record<string, string> {
  if (connectorId === "postgres") {
    return normalizePostgresConnectionValues(values);
  }
  return { ...values };
}

export function getVisibleSecretFields(
  connectorId: ConnectorId,
  values: Record<string, string>,
) {
  return getVisibleFields(getConnectionFields(connectorId), values).filter(
    (field) => SECRET_FIELD_NAMES.has(field.name),
  );
}

export function areSecretsFilled(
  connectorId: ConnectorId,
  values: Record<string, string>,
): boolean {
  return getVisibleSecretFields(connectorId, values)
    .filter((field) => field.required)
    .every((field) => (values[field.name] ?? "").trim().length > 0);
}

/** True when this saved connection may rescan without asking again. */
export function hasUsableStoredSecrets(saved: SavedConnection): boolean {
  return (
    saved.storeSecrets === true &&
    areSecretsFilled(saved.connectorId, saved.connectionValues)
  );
}

function normalizeSaved(item: SavedConnection): SavedConnection {
  const storeSecrets = item.storeSecrets === true;
  return {
    ...item,
    storeSecrets,
    connectionValues: prepareConnectionValues(
      item.connectionValues ?? {},
      storeSecrets,
    ),
  };
}

function describeDatabases(values: Record<string, string>): string | null {
  if (values.databaseMode === "all") return "all databases";
  const listed = (values.databases ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (listed.length > 1) return `${listed.length} databases`;
  if (listed.length === 1) return listed[0];
  return values.database?.trim() || null;
}

export function buildConnectionLabel(
  connectorId: ConnectorId,
  values: Record<string, string>,
): string {
  const name = getScanResult(connectorId)?.name ?? connectorId;
  const host = values.host?.trim();
  const databases = describeDatabases(values);
  const vendor = values.vendor?.trim();

  if (vendor) {
    const vendorLabel = vendor === "zoho" ? "Zoho" : "HubSpot";
    return `${name} · ${vendorLabel}`;
  }
  if (host && databases) return `${name} · ${host} / ${databases}`;
  if (host) return `${name} · ${host}`;
  return name;
}

export function buildConnectionSummary(
  values: Record<string, string>,
): string {
  const parts: string[] = [];
  if (values.protocol) parts.push(values.protocol.toUpperCase());
  if (values.host) {
    const port = values.port ? `:${values.port}` : "";
    parts.push(`${values.host}${port}`);
  }
  const databases = describeDatabases(values);
  if (databases) {
    parts.push(
      values.databaseMode === "all" || (values.databases ?? "").includes(",")
        ? databases
        : `db ${databases}`,
    );
  }
  if (values.shareName) parts.push(`share ${values.shareName}`);
  if (values.username) parts.push(`user ${values.username}`);
  if (values.vendor) parts.push(values.vendor);
  return parts.length > 0 ? parts.join(" · ") : "Connection configured";
}

export function buildScopeSummary(values: Record<string, string>): string {
  const mode =
    values.coverageMode === "full" ? "Deep scan" : "Sampled scan";
  const rate = values.samplingRate ?? values.samplingRateFull;
  if (rate) return `${mode} · ${rate}% rows/docs`;
  if (values.maxFiles) return `${mode} · up to ${values.maxFiles} files`;
  if (values.objectsPerType) {
    return `${mode} · ${values.objectsPerType} objects/type`;
  }
  return mode;
}

const EMPTY_SAVED: SavedConnection[] = [];
let cachedSavedConnections: SavedConnection[] = EMPTY_SAVED;
let savedCacheHydrated = false;

function readSavedFromStorage(): SavedConnection[] {
  if (!canUseStorage()) return EMPTY_SAVED;
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return EMPTY_SAVED;
    const parsed = JSON.parse(raw) as SavedConnection[];
    if (!Array.isArray(parsed) || parsed.length === 0) return EMPTY_SAVED;
    return parsed
      .map(normalizeSaved)
      .sort((a, b) => b.lastScannedAt.localeCompare(a.lastScannedAt));
  } catch {
    return EMPTY_SAVED;
  }
}

/** Stable snapshot for useSyncExternalStore — same reference until data changes. */
export function getSavedConnectionsSnapshot(): SavedConnection[] {
  if (!canUseStorage()) return EMPTY_SAVED;
  if (!savedCacheHydrated) {
    cachedSavedConnections = readSavedFromStorage();
    savedCacheHydrated = true;
  }
  return cachedSavedConnections;
}

export function listSavedConnections(): SavedConnection[] {
  return getSavedConnectionsSnapshot();
}

function writeSaved(connections: SavedConnection[]) {
  const next =
    connections.length === 0
      ? EMPTY_SAVED
      : [...connections]
          .map(normalizeSaved)
          .sort((a, b) => b.lastScannedAt.localeCompare(a.lastScannedAt));
  window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  cachedSavedConnections = next;
  savedCacheHydrated = true;
  notifySavedConnectionsChanged();
}

const savedListeners = new Set<() => void>();

export function subscribeSavedConnections(onStoreChange: () => void) {
  savedListeners.add(onStoreChange);
  return () => {
    savedListeners.delete(onStoreChange);
  };
}

export function notifySavedConnectionsChanged() {
  for (const listener of savedListeners) listener();
}

export function getSavedConnection(id: string): SavedConnection | undefined {
  return getSavedConnectionsSnapshot().find((c) => c.id === id);
}

export function upsertSavedConnection(input: {
  id?: string;
  connectorId: ConnectorId;
  connectionValues: Record<string, string>;
  scopeValues: Record<string, string>;
  storeSecrets?: boolean;
  lastScanResult?: SavedScanResult;
}): SavedConnection {
  const now = new Date().toISOString();
  const existing = listSavedConnections();
  const storeSecrets = input.storeSecrets === true;
  const connectionValues = prepareConnectionValues(
    normalizeConnectionValues(input.connectorId, input.connectionValues),
    storeSecrets,
  );
  const scopeValues = { ...input.scopeValues };
  const label = buildConnectionLabel(input.connectorId, connectionValues);
  const connectionSummary = buildConnectionSummary(connectionValues);
  const scopeSummary = buildScopeSummary(scopeValues);

  if (input.id) {
    const updated = existing.map((item) =>
      item.id === input.id
        ? {
            ...item,
            connectorId: input.connectorId,
            label,
            connectionSummary,
            scopeSummary,
            storeSecrets,
            connectionValues,
            scopeValues,
            lastScanResult:
              input.lastScanResult !== undefined
                ? input.lastScanResult
                : item.lastScanResult,
            lastScannedAt: now,
          }
        : item,
    );
    const found = updated.find((item) => item.id === input.id);
    if (found) {
      writeSaved(updated);
      return found;
    }
  }

  const created: SavedConnection = {
    id: crypto.randomUUID(),
    connectorId: input.connectorId,
    label,
    connectionSummary,
    scopeSummary,
    storeSecrets,
    connectionValues,
    scopeValues,
    lastScanResult: input.lastScanResult,
    lastScannedAt: now,
    createdAt: now,
  };
  writeSaved([created, ...existing]);
  return created;
}

export function touchSavedConnection(
  id: string,
  lastScanResult?: SavedScanResult,
): SavedConnection | undefined {
  const existing = listSavedConnections();
  const now = new Date().toISOString();
  let touched: SavedConnection | undefined;
  const next = existing.map((item) => {
    if (item.id !== id) return item;
    touched = {
      ...item,
      lastScannedAt: now,
      lastScanResult:
        lastScanResult !== undefined ? lastScanResult : item.lastScanResult,
    };
    return touched;
  });
  if (touched) writeSaved(next);
  return touched;
}

/** Update connection/scope without running a scan (lastScannedAt unchanged unless requested). */
export function updateSavedConnection(input: {
  id: string;
  connectionValues?: Record<string, string>;
  scopeValues?: Record<string, string>;
  storeSecrets?: boolean;
  touchScan?: boolean;
  lastScanResult?: SavedScanResult;
}): SavedConnection | undefined {
  const existing = listSavedConnections();
  const now = new Date().toISOString();
  let updated: SavedConnection | undefined;

  const next = existing.map((item) => {
    if (item.id !== input.id) return item;

    const storeSecrets =
      input.storeSecrets !== undefined
        ? input.storeSecrets === true
        : item.storeSecrets;

    const connectionValues = input.connectionValues
      ? prepareConnectionValues(
          normalizeConnectionValues(item.connectorId, input.connectionValues),
          storeSecrets,
        )
      : prepareConnectionValues(item.connectionValues, storeSecrets);

    const scopeValues = input.scopeValues
      ? { ...input.scopeValues }
      : item.scopeValues;

    updated = {
      ...item,
      storeSecrets,
      connectionValues,
      scopeValues,
      label: buildConnectionLabel(item.connectorId, connectionValues),
      connectionSummary: buildConnectionSummary(connectionValues),
      scopeSummary: buildScopeSummary(scopeValues),
      lastScanResult:
        input.lastScanResult !== undefined
          ? input.lastScanResult
          : item.lastScanResult,
      lastScannedAt: input.touchScan ? now : item.lastScannedAt,
    };
    return updated;
  });

  if (updated) writeSaved(next);
  return updated;
}

export function removeSavedConnection(id: string) {
  writeSaved(listSavedConnections().filter((item) => item.id !== id));
}

export function saveDiscoveryDraft(draft: DiscoveryDraft) {
  if (!canUseStorage()) return;
  const storeSecrets = draft.storeSecrets === true;
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      ...draft,
      storeSecrets,
      // Wizard draft keeps secrets in sessionStorage so the scan can run.
      // Long-lived localStorage persistence still respects storeSecrets.
      connectionValues: { ...draft.connectionValues },
      scopeValues: draft.scopeValues,
    } satisfies DiscoveryDraft),
  );
}

export function loadDiscoveryDraft(): DiscoveryDraft | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiscoveryDraft;
  } catch {
    return null;
  }
}

export function clearDiscoveryDraft() {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(DRAFT_KEY);
}

/** Test helper — clears persistence and snapshot cache. */
export function resetSavedConnectionsStoreForTests() {
  cachedSavedConnections = EMPTY_SAVED;
  savedCacheHydrated = false;
  if (canUseStorage()) {
    window.localStorage.removeItem(SAVED_KEY);
    window.sessionStorage.removeItem(DRAFT_KEY);
  }
  notifySavedConnectionsChanged();
}

export function formatScannedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
