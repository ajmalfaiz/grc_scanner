import {
  getScanResult,
  type ConnectorId,
  type Finding,
} from "@/lib/discovery-mock-data";

export const FINDINGS_PAGE_SIZE = 25;
export const MAX_FINDINGS_PAGE_SIZE = 100;

export type PaginatedFindingsResponse = {
  connectorId: ConnectorId;
  page: number;
  pageSize: number;
  total: number;
  items: Finding[];
  hasMore: boolean;
};

export function normalizeFindingsPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeFindingsPageSize(value: string | null): number {
  const parsed = Number.parseInt(value ?? String(FINDINGS_PAGE_SIZE), 10);
  if (!Number.isFinite(parsed)) return FINDINGS_PAGE_SIZE;
  return Math.min(Math.max(parsed, 1), MAX_FINDINGS_PAGE_SIZE);
}

export function getPaginatedScanFindings({
  connectorId,
  page,
  pageSize,
}: {
  connectorId: ConnectorId;
  page: number;
  pageSize: number;
}): PaginatedFindingsResponse | null {
  if (connectorId === "postgres") return null;

  const result = getScanResult(connectorId);
  if (!result) return null;

  const start = page * pageSize;
  const items = result.findings.slice(start, start + pageSize);
  const total = result.findings.length;

  return {
    connectorId,
    page,
    pageSize,
    total,
    items,
    hasMore: start + items.length < total,
  };
}
