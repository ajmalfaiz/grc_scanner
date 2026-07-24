import {
  store,
  type AiTool,
  type ApprovalStatus,
  type Confidence,
} from "@/lib/governance-store";

export async function getOverviewStats() {
  const totalDevices = store.devices.length;
  const monitoredDevices = store.devices.filter((d) => d.isMonitored).length;
  const unmonitoredDevices = totalDevices - monitoredDevices;

  const devicesWithActivity = new Set(store.findings.map((f) => f.deviceId))
    .size;
  const toolsById = new Map(store.aiTools.map((t) => [t.id, t]));
  const unapprovedUsageCount = store.findings.filter(
    (f) => toolsById.get(f.toolId)?.approvalStatus === "unapproved",
  ).length;

  return {
    totalDevices,
    monitoredDevices,
    unmonitoredDevices,
    devicesWithActivity,
    unapprovedUsageCount,
    totalFindings: store.findings.length,
  };
}

export async function getUsageByTool() {
  const toolsById = new Map(store.aiTools.map((t) => [t.id, t]));
  const totals = new Map<string, { tool: string; vendor: string; connections: number }>();

  for (const finding of store.findings) {
    const tool = toolsById.get(finding.toolId);
    if (!tool) continue;
    const key = `${tool.name}::${tool.vendor}`;
    const existing = totals.get(key) ?? {
      tool: tool.name,
      vendor: tool.vendor,
      connections: 0,
    };
    existing.connections += finding.connectionCount;
    totals.set(key, existing);
  }

  return [...totals.values()].sort((a, b) => b.connections - a.connections);
}

export async function getUsageTrend(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  return store.usageTrends
    .filter((row) => row.day >= sinceStr)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day));
}

export type FindingFilters = {
  approval?: string;
  confidence?: string;
  tool?: string;
  from?: string;
  to?: string;
};

function findingRows() {
  const devicesById = new Map(store.devices.map((d) => [d.id, d]));
  const toolsById = new Map(store.aiTools.map((t) => [t.id, t]));

  return store.findings.map((finding) => {
    const device = devicesById.get(finding.deviceId);
    const tool = toolsById.get(finding.toolId);
    return {
      id: finding.id,
      connectionCount: finding.connectionCount,
      dataVolumeBytes: finding.dataVolumeBytes,
      confidence: finding.confidence,
      lastSeen: finding.lastSeen,
      coverageNote: finding.coverageNote,
      deviceName: device?.name ?? "Unknown",
      employeeId: device?.employeeId ?? null,
      department: device?.department ?? null,
      toolName: tool?.name ?? "Unknown",
      toolVendor: tool?.vendor ?? "Unknown",
      domain: tool?.domain ?? "unknown",
      approvalStatus: tool?.approvalStatus ?? ("unapproved" as ApprovalStatus),
      toolId: finding.toolId,
    };
  });
}

export async function getFindings(filters: FindingFilters = {}) {
  let rows = findingRows();

  if (filters.approval && filters.approval !== "all") {
    rows = rows.filter((r) => r.approvalStatus === filters.approval);
  }
  if (filters.confidence && filters.confidence !== "all") {
    rows = rows.filter((r) => r.confidence === filters.confidence);
  }
  if (filters.tool && filters.tool !== "all") {
    rows = rows.filter((r) => r.toolName === filters.tool);
  }
  if (filters.from) {
    const from = new Date(filters.from);
    rows = rows.filter((r) => r.lastSeen >= from);
  }

  return rows.sort((a, b) => {
    const confRank = (c: Confidence) => (c === "high" ? 0 : 1);
    const byConf = confRank(a.confidence) - confRank(b.confidence);
    if (byConf !== 0) return byConf;
    return b.lastSeen.getTime() - a.lastSeen.getTime();
  });
}

export async function getFindingById(id: string) {
  const row = findingRows().find((r) => r.id === id);
  if (!row) return null;

  const events = store.connectionEvents
    .filter((e) => e.findingId === id)
    .slice()
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return { ...row, events };
}

export async function getToolNames() {
  return [...new Set(store.aiTools.map((t) => t.name))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function getAiTools() {
  return store.aiTools
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUnmonitoredDevices() {
  return store.devices
    .filter((d) => !d.isMonitored)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateToolApproval(
  toolId: string,
  status: ApprovalStatus,
) {
  const tool = store.aiTools.find((t) => t.id === toolId);
  if (!tool) return undefined;
  tool.approvalStatus = status;
  return tool;
}

export async function addAiTool(input: {
  name: string;
  vendor: string;
  domain: string;
  approvalStatus: ApprovalStatus;
}): Promise<AiTool> {
  if (store.aiTools.some((t) => t.domain === input.domain)) {
    throw new Error("duplicate");
  }

  const created: AiTool = {
    id: `tool-${crypto.randomUUID()}`,
    name: input.name,
    vendor: input.vendor,
    domain: input.domain,
    approvalStatus: input.approvalStatus,
    createdAt: new Date(),
  };
  store.aiTools.push(created);
  return created;
}

export async function removeAiTool(toolId: string) {
  if (store.findings.some((f) => f.toolId === toolId)) {
    throw new Error("referenced");
  }
  const index = store.aiTools.findIndex((t) => t.id === toolId);
  if (index === -1) return;
  store.aiTools.splice(index, 1);
}
