import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  aiTools,
  connectionEvents,
  devices,
  findings,
  usageTrends,
} from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d;
}

function dayString(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  console.log("Seeding AI Governance prototype data...");

  await db.delete(connectionEvents);
  await db.delete(findings);
  await db.delete(usageTrends);
  await db.delete(aiTools);
  await db.delete(devices);

  const insertedDevices = await db
    .insert(devices)
    .values([
      {
        name: "LAPTOP-4821",
        employeeId: "EMP-1042",
        department: "Engineering",
        isMonitored: true,
      },
      {
        name: "LAPTOP-1193",
        employeeId: "EMP-2088",
        department: "Marketing",
        isMonitored: true,
      },
      {
        name: "DESKTOP-7740",
        employeeId: "EMP-0911",
        department: "Finance",
        isMonitored: true,
      },
      {
        name: "LAPTOP-3301",
        employeeId: "EMP-4412",
        department: "Product",
        isMonitored: true,
      },
      {
        name: "LAPTOP-9012",
        employeeId: "EMP-3320",
        department: "Sales",
        isMonitored: true,
      },
      {
        name: "MACBOOK-2204",
        employeeId: "EMP-5510",
        department: "Design",
        isMonitored: true,
      },
      {
        name: "LAPTOP-6677",
        employeeId: "EMP-7721",
        department: "Engineering",
        isMonitored: true,
      },
      {
        name: "DESKTOP-4410",
        employeeId: "EMP-1190",
        department: "HR",
        isMonitored: true,
      },
      {
        name: "IPHONE-8821",
        employeeId: "EMP-1042",
        department: "Engineering",
        isMonitored: false,
        coverageReason: "unmanaged_device",
      },
      {
        name: "LAPTOP-PERSONAL",
        employeeId: "EMP-2088",
        department: "Marketing",
        isMonitored: false,
        coverageReason: "proxy_not_configured",
      },
      {
        name: "TABLET-1190",
        employeeId: "EMP-1190",
        department: "HR",
        isMonitored: false,
        coverageReason: "off_network",
      },
      {
        name: "LAPTOP-UNKNOWN",
        employeeId: null,
        department: null,
        isMonitored: false,
        coverageReason: "unknown",
      },
    ])
    .returning();

  const insertedTools = await db
    .insert(aiTools)
    .values([
      {
        name: "ChatGPT",
        vendor: "OpenAI",
        domain: "chat.openai.com",
        approvalStatus: "unapproved",
      },
      {
        name: "ChatGPT",
        vendor: "OpenAI",
        domain: "api.openai.com",
        approvalStatus: "unapproved",
      },
      {
        name: "Claude",
        vendor: "Anthropic",
        domain: "claude.ai",
        approvalStatus: "approved",
      },
      {
        name: "Gemini",
        vendor: "Google",
        domain: "gemini.google.com",
        approvalStatus: "under_review",
      },
      {
        name: "Copilot",
        vendor: "Microsoft",
        domain: "copilot.microsoft.com",
        approvalStatus: "approved",
      },
      {
        name: "Perplexity",
        vendor: "Perplexity AI",
        domain: "www.perplexity.ai",
        approvalStatus: "unapproved",
      },
      {
        name: "Cursor",
        vendor: "Anysphere",
        domain: "api2.cursor.sh",
        approvalStatus: "under_review",
      },
      {
        name: "Groq",
        vendor: "Groq",
        domain: "api.groq.com",
        approvalStatus: "unapproved",
      },
    ])
    .returning();

  const byName = (name: string) =>
    insertedDevices.find((d) => d.name === name)!;
  const byDomain = (domain: string) =>
    insertedTools.find((t) => t.domain === domain)!;

  const findingRows = [
    {
      deviceId: byName("LAPTOP-4821").id,
      toolId: byDomain("chat.openai.com").id,
      connectionCount: 43,
      dataVolumeBytes: 2_100_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 14),
    },
    {
      deviceId: byName("LAPTOP-1193").id,
      toolId: byDomain("claude.ai").id,
      connectionCount: 28,
      dataVolumeBytes: 890_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 11),
    },
    {
      deviceId: byName("DESKTOP-7740").id,
      toolId: byDomain("gemini.google.com").id,
      connectionCount: 17,
      dataVolumeBytes: 540_000,
      confidence: "medium" as const,
      lastSeen: daysAgo(1, 16),
    },
    {
      deviceId: byName("LAPTOP-3301").id,
      toolId: byDomain("www.perplexity.ai").id,
      connectionCount: 12,
      dataVolumeBytes: 320_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 9),
    },
    {
      deviceId: byName("LAPTOP-9012").id,
      toolId: byDomain("chat.openai.com").id,
      connectionCount: 61,
      dataVolumeBytes: 4_200_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 15),
    },
    {
      deviceId: byName("MACBOOK-2204").id,
      toolId: byDomain("copilot.microsoft.com").id,
      connectionCount: 9,
      dataVolumeBytes: 180_000,
      confidence: "high" as const,
      lastSeen: daysAgo(2, 10),
    },
    {
      deviceId: byName("LAPTOP-6677").id,
      toolId: byDomain("api2.cursor.sh").id,
      connectionCount: 156,
      dataVolumeBytes: 12_400_000,
      confidence: "medium" as const,
      lastSeen: daysAgo(0, 13),
    },
    {
      deviceId: byName("DESKTOP-4410").id,
      toolId: byDomain("claude.ai").id,
      connectionCount: 5,
      dataVolumeBytes: 95_000,
      confidence: "high" as const,
      lastSeen: daysAgo(3, 8),
    },
    {
      deviceId: byName("LAPTOP-4821").id,
      toolId: byDomain("api.openai.com").id,
      connectionCount: 22,
      dataVolumeBytes: 1_800_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 12),
    },
    {
      deviceId: byName("LAPTOP-3301").id,
      toolId: byDomain("gemini.google.com").id,
      connectionCount: 8,
      dataVolumeBytes: 210_000,
      confidence: "medium" as const,
      lastSeen: daysAgo(1, 17),
    },
    {
      deviceId: byName("LAPTOP-1193").id,
      toolId: byDomain("chat.openai.com").id,
      connectionCount: 34,
      dataVolumeBytes: 1_500_000,
      confidence: "high" as const,
      lastSeen: daysAgo(0, 10),
    },
    {
      deviceId: byName("LAPTOP-9012").id,
      toolId: byDomain("api.groq.com").id,
      connectionCount: 7,
      dataVolumeBytes: 410_000,
      confidence: "medium" as const,
      lastSeen: daysAgo(4, 14),
    },
  ];

  const insertedFindings = await db
    .insert(findings)
    .values(findingRows)
    .returning();

  const events = insertedFindings.flatMap((finding) => {
    const count = Math.min(finding.connectionCount, 12);
    return Array.from({ length: count }, (_, i) => ({
      findingId: finding.id,
      occurredAt: daysAgo(Math.floor(i * 0.6), 8 + (i % 10)),
      bytesSent: Math.floor(finding.dataVolumeBytes / count),
    }));
  });

  await db.insert(connectionEvents).values(events);

  const trendValues = Array.from({ length: 30 }, (_, i) => {
    const dayIndex = 29 - i;
    const base = 80 + Math.sin(i / 3) * 30;
    return {
      day: dayString(dayIndex),
      connectionCount: Math.round(base + (i % 5) * 12 + Math.random() * 40),
    };
  });

  await db.insert(usageTrends).values(trendValues);

  console.log("Seed complete.");
  console.log(`  Devices: ${insertedDevices.length}`);
  console.log(`  Tools: ${insertedTools.length}`);
  console.log(`  Findings: ${insertedFindings.length}`);
  console.log(`  Events: ${events.length}`);
  console.log(`  Trend days: ${trendValues.length}`);

  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
