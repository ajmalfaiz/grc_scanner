import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  bigint,
  date,
} from "drizzle-orm/pg-core";

export const approvalStatusEnum = pgEnum("approval_status", [
  "approved",
  "unapproved",
  "under_review",
]);

export const confidenceEnum = pgEnum("confidence", ["high", "medium"]);

export const coverageReasonEnum = pgEnum("coverage_reason", [
  "unmanaged_device",
  "off_network",
  "proxy_not_configured",
  "unknown",
]);

export const devices = pgTable("devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  employeeId: text("employee_id"),
  department: text("department"),
  isMonitored: boolean("is_monitored").notNull().default(true),
  coverageReason: coverageReasonEnum("coverage_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiTools = pgTable("ai_tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  vendor: text("vendor").notNull(),
  domain: text("domain").notNull().unique(),
  approvalStatus: approvalStatusEnum("approval_status")
    .notNull()
    .default("unapproved"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => aiTools.id),
  connectionCount: integer("connection_count").notNull().default(0),
  dataVolumeBytes: bigint("data_volume_bytes", { mode: "number" })
    .notNull()
    .default(0),
  confidence: confidenceEnum("confidence").notNull().default("high"),
  lastSeen: timestamp("last_seen").notNull(),
  coverageNote: text("coverage_note").notNull().default("Monitored (proxy active)"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const connectionEvents = pgTable("connection_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  occurredAt: timestamp("occurred_at").notNull(),
  bytesSent: bigint("bytes_sent", { mode: "number" }).notNull().default(0),
});

export const usageTrends = pgTable("usage_trends", {
  id: uuid("id").defaultRandom().primaryKey(),
  day: date("day").notNull().unique(),
  connectionCount: integer("connection_count").notNull().default(0),
});

export type Device = typeof devices.$inferSelect;
export type AiTool = typeof aiTools.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type ConnectionEvent = typeof connectionEvents.$inferSelect;
export type UsageTrend = typeof usageTrends.$inferSelect;
