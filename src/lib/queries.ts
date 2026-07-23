import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiTools,
  connectionEvents,
  devices,
  findings,
  usageTrends,
} from "@/db/schema";

export async function getOverviewStats() {
  const [deviceStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      monitored: sql<number>`count(*) filter (where ${devices.isMonitored})::int`,
      unmonitored: sql<number>`count(*) filter (where not ${devices.isMonitored})::int`,
    })
    .from(devices);

  const [activityStats] = await db
    .select({
      devicesWithActivity: sql<number>`count(distinct ${findings.deviceId})::int`,
      unapprovedUsage: sql<number>`count(*) filter (where ${aiTools.approvalStatus} = 'unapproved')::int`,
      totalFindings: sql<number>`count(*)::int`,
    })
    .from(findings)
    .innerJoin(aiTools, eq(findings.toolId, aiTools.id));

  return {
    totalDevices: deviceStats?.total ?? 0,
    monitoredDevices: deviceStats?.monitored ?? 0,
    unmonitoredDevices: deviceStats?.unmonitored ?? 0,
    devicesWithActivity: activityStats?.devicesWithActivity ?? 0,
    unapprovedUsageCount: activityStats?.unapprovedUsage ?? 0,
    totalFindings: activityStats?.totalFindings ?? 0,
  };
}

export async function getUsageByTool() {
  return db
    .select({
      tool: aiTools.name,
      vendor: aiTools.vendor,
      connections: sql<number>`coalesce(sum(${findings.connectionCount}), 0)::int`,
    })
    .from(findings)
    .innerJoin(aiTools, eq(findings.toolId, aiTools.id))
    .groupBy(aiTools.name, aiTools.vendor)
    .orderBy(sql`sum(${findings.connectionCount}) desc`);
}

export async function getUsageTrend(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  return db
    .select()
    .from(usageTrends)
    .where(gte(usageTrends.day, sinceStr))
    .orderBy(usageTrends.day);
}

export type FindingFilters = {
  approval?: string;
  confidence?: string;
  tool?: string;
  from?: string;
  to?: string;
};

export async function getFindings(filters: FindingFilters = {}) {
  const conditions = [];

  if (filters.approval && filters.approval !== "all") {
    conditions.push(
      eq(
        aiTools.approvalStatus,
        filters.approval as "approved" | "unapproved" | "under_review",
      ),
    );
  }

  if (filters.confidence && filters.confidence !== "all") {
    conditions.push(
      eq(findings.confidence, filters.confidence as "high" | "medium"),
    );
  }

  if (filters.tool && filters.tool !== "all") {
    conditions.push(eq(aiTools.name, filters.tool));
  }

  if (filters.from) {
    conditions.push(gte(findings.lastSeen, new Date(filters.from)));
  }

  const rows = await db
    .select({
      id: findings.id,
      connectionCount: findings.connectionCount,
      dataVolumeBytes: findings.dataVolumeBytes,
      confidence: findings.confidence,
      lastSeen: findings.lastSeen,
      coverageNote: findings.coverageNote,
      deviceName: devices.name,
      employeeId: devices.employeeId,
      department: devices.department,
      toolName: aiTools.name,
      toolVendor: aiTools.vendor,
      domain: aiTools.domain,
      approvalStatus: aiTools.approvalStatus,
      toolId: aiTools.id,
    })
    .from(findings)
    .innerJoin(devices, eq(findings.deviceId, devices.id))
    .innerJoin(aiTools, eq(findings.toolId, aiTools.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      sql`case when ${findings.confidence} = 'high' then 0 else 1 end`,
      desc(findings.lastSeen),
    );

  return rows;
}

export async function getFindingById(id: string) {
  const [row] = await db
    .select({
      id: findings.id,
      connectionCount: findings.connectionCount,
      dataVolumeBytes: findings.dataVolumeBytes,
      confidence: findings.confidence,
      lastSeen: findings.lastSeen,
      coverageNote: findings.coverageNote,
      deviceName: devices.name,
      employeeId: devices.employeeId,
      department: devices.department,
      toolName: aiTools.name,
      toolVendor: aiTools.vendor,
      domain: aiTools.domain,
      approvalStatus: aiTools.approvalStatus,
      toolId: aiTools.id,
    })
    .from(findings)
    .innerJoin(devices, eq(findings.deviceId, devices.id))
    .innerJoin(aiTools, eq(findings.toolId, aiTools.id))
    .where(eq(findings.id, id))
    .limit(1);

  if (!row) return null;

  const events = await db
    .select()
    .from(connectionEvents)
    .where(eq(connectionEvents.findingId, id))
    .orderBy(desc(connectionEvents.occurredAt));

  return { ...row, events };
}

export async function getToolNames() {
  const rows = await db
    .selectDistinct({ name: aiTools.name })
    .from(aiTools)
    .orderBy(aiTools.name);
  return rows.map((r) => r.name);
}

export async function getAiTools() {
  return db.select().from(aiTools).orderBy(aiTools.name);
}

export async function getUnmonitoredDevices() {
  return db
    .select()
    .from(devices)
    .where(eq(devices.isMonitored, false))
    .orderBy(devices.name);
}

export async function updateToolApproval(
  toolId: string,
  status: "approved" | "unapproved" | "under_review",
) {
  const [updated] = await db
    .update(aiTools)
    .set({ approvalStatus: status })
    .where(eq(aiTools.id, toolId))
    .returning();
  return updated;
}

export async function addAiTool(input: {
  name: string;
  vendor: string;
  domain: string;
  approvalStatus: "approved" | "unapproved" | "under_review";
}) {
  const [created] = await db.insert(aiTools).values(input).returning();
  return created;
}

export async function removeAiTool(toolId: string) {
  await db.delete(aiTools).where(eq(aiTools.id, toolId));
}
