export type ApprovalStatus = "approved" | "unapproved" | "under_review";
export type Confidence = "high" | "medium";
export type CoverageReason =
  | "unmanaged_device"
  | "off_network"
  | "proxy_not_configured"
  | "unknown";

export type Device = {
  id: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  isMonitored: boolean;
  coverageReason: CoverageReason | null;
  createdAt: Date;
};

export type AiTool = {
  id: string;
  name: string;
  vendor: string;
  domain: string;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
};

export type Finding = {
  id: string;
  deviceId: string;
  toolId: string;
  connectionCount: number;
  dataVolumeBytes: number;
  confidence: Confidence;
  lastSeen: Date;
  coverageNote: string;
  createdAt: Date;
};

export type ConnectionEvent = {
  id: string;
  findingId: string;
  occurredAt: Date;
  bytesSent: number;
};

export type UsageTrend = {
  id: string;
  day: string;
  connectionCount: number;
};

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 7) % 50, 0, 0);
  return d;
}

function dayString(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

const devices: Device[] = [
  {
    id: id("dev", 1),
    name: "LAPTOP-4821",
    employeeId: "EMP-1042",
    department: "Engineering",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(60),
  },
  {
    id: id("dev", 2),
    name: "LAPTOP-1193",
    employeeId: "EMP-2088",
    department: "Marketing",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(58),
  },
  {
    id: id("dev", 3),
    name: "DESKTOP-7740",
    employeeId: "EMP-0911",
    department: "Finance",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(55),
  },
  {
    id: id("dev", 4),
    name: "LAPTOP-3301",
    employeeId: "EMP-4412",
    department: "Product",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(50),
  },
  {
    id: id("dev", 5),
    name: "LAPTOP-9012",
    employeeId: "EMP-3320",
    department: "Sales",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(48),
  },
  {
    id: id("dev", 6),
    name: "MACBOOK-2204",
    employeeId: "EMP-5510",
    department: "Design",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(45),
  },
  {
    id: id("dev", 7),
    name: "LAPTOP-6677",
    employeeId: "EMP-7721",
    department: "Engineering",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(40),
  },
  {
    id: id("dev", 8),
    name: "DESKTOP-4410",
    employeeId: "EMP-1190",
    department: "HR",
    isMonitored: true,
    coverageReason: null,
    createdAt: daysAgo(38),
  },
  {
    id: id("dev", 9),
    name: "IPHONE-8821",
    employeeId: "EMP-1042",
    department: "Engineering",
    isMonitored: false,
    coverageReason: "unmanaged_device",
    createdAt: daysAgo(30),
  },
  {
    id: id("dev", 10),
    name: "LAPTOP-PERSONAL",
    employeeId: "EMP-2088",
    department: "Marketing",
    isMonitored: false,
    coverageReason: "proxy_not_configured",
    createdAt: daysAgo(28),
  },
  {
    id: id("dev", 11),
    name: "TABLET-1190",
    employeeId: "EMP-1190",
    department: "HR",
    isMonitored: false,
    coverageReason: "off_network",
    createdAt: daysAgo(20),
  },
  {
    id: id("dev", 12),
    name: "LAPTOP-UNKNOWN",
    employeeId: null,
    department: null,
    isMonitored: false,
    coverageReason: "unknown",
    createdAt: daysAgo(15),
  },
];

const aiTools: AiTool[] = [
  {
    id: id("tool", 1),
    name: "ChatGPT",
    vendor: "OpenAI",
    domain: "chat.openai.com",
    approvalStatus: "unapproved",
    createdAt: daysAgo(90),
  },
  {
    id: id("tool", 2),
    name: "ChatGPT",
    vendor: "OpenAI",
    domain: "api.openai.com",
    approvalStatus: "unapproved",
    createdAt: daysAgo(90),
  },
  {
    id: id("tool", 3),
    name: "Claude",
    vendor: "Anthropic",
    domain: "claude.ai",
    approvalStatus: "approved",
    createdAt: daysAgo(90),
  },
  {
    id: id("tool", 4),
    name: "Gemini",
    vendor: "Google",
    domain: "gemini.google.com",
    approvalStatus: "under_review",
    createdAt: daysAgo(80),
  },
  {
    id: id("tool", 5),
    name: "Copilot",
    vendor: "Microsoft",
    domain: "copilot.microsoft.com",
    approvalStatus: "approved",
    createdAt: daysAgo(80),
  },
  {
    id: id("tool", 6),
    name: "Perplexity",
    vendor: "Perplexity AI",
    domain: "www.perplexity.ai",
    approvalStatus: "unapproved",
    createdAt: daysAgo(70),
  },
  {
    id: id("tool", 7),
    name: "Cursor",
    vendor: "Anysphere",
    domain: "api2.cursor.sh",
    approvalStatus: "under_review",
    createdAt: daysAgo(60),
  },
  {
    id: id("tool", 8),
    name: "Groq",
    vendor: "Groq",
    domain: "api.groq.com",
    approvalStatus: "unapproved",
    createdAt: daysAgo(50),
  },
];

function byName(name: string) {
  return devices.find((d) => d.name === name)!;
}

function byDomain(domain: string) {
  return aiTools.find((t) => t.domain === domain)!;
}

const findingSeed: Array<{
  deviceName: string;
  domain: string;
  connectionCount: number;
  dataVolumeBytes: number;
  confidence: Confidence;
  lastSeen: Date;
}> = [
  {
    deviceName: "LAPTOP-4821",
    domain: "chat.openai.com",
    connectionCount: 43,
    dataVolumeBytes: 2_100_000,
    confidence: "high",
    lastSeen: daysAgo(0, 14),
  },
  {
    deviceName: "LAPTOP-1193",
    domain: "claude.ai",
    connectionCount: 28,
    dataVolumeBytes: 890_000,
    confidence: "high",
    lastSeen: daysAgo(0, 11),
  },
  {
    deviceName: "DESKTOP-7740",
    domain: "gemini.google.com",
    connectionCount: 17,
    dataVolumeBytes: 540_000,
    confidence: "medium",
    lastSeen: daysAgo(1, 16),
  },
  {
    deviceName: "LAPTOP-3301",
    domain: "www.perplexity.ai",
    connectionCount: 12,
    dataVolumeBytes: 320_000,
    confidence: "high",
    lastSeen: daysAgo(0, 9),
  },
  {
    deviceName: "LAPTOP-9012",
    domain: "chat.openai.com",
    connectionCount: 61,
    dataVolumeBytes: 4_200_000,
    confidence: "high",
    lastSeen: daysAgo(0, 15),
  },
  {
    deviceName: "MACBOOK-2204",
    domain: "copilot.microsoft.com",
    connectionCount: 9,
    dataVolumeBytes: 180_000,
    confidence: "high",
    lastSeen: daysAgo(2, 10),
  },
  {
    deviceName: "LAPTOP-6677",
    domain: "api2.cursor.sh",
    connectionCount: 156,
    dataVolumeBytes: 12_400_000,
    confidence: "medium",
    lastSeen: daysAgo(0, 13),
  },
  {
    deviceName: "DESKTOP-4410",
    domain: "claude.ai",
    connectionCount: 5,
    dataVolumeBytes: 95_000,
    confidence: "high",
    lastSeen: daysAgo(3, 8),
  },
  {
    deviceName: "LAPTOP-4821",
    domain: "api.openai.com",
    connectionCount: 22,
    dataVolumeBytes: 1_800_000,
    confidence: "high",
    lastSeen: daysAgo(0, 12),
  },
  {
    deviceName: "LAPTOP-3301",
    domain: "gemini.google.com",
    connectionCount: 8,
    dataVolumeBytes: 210_000,
    confidence: "medium",
    lastSeen: daysAgo(1, 17),
  },
  {
    deviceName: "LAPTOP-1193",
    domain: "chat.openai.com",
    connectionCount: 34,
    dataVolumeBytes: 1_500_000,
    confidence: "high",
    lastSeen: daysAgo(0, 10),
  },
  {
    deviceName: "LAPTOP-9012",
    domain: "api.groq.com",
    connectionCount: 7,
    dataVolumeBytes: 410_000,
    confidence: "medium",
    lastSeen: daysAgo(4, 14),
  },
];

const findings: Finding[] = findingSeed.map((row, index) => ({
  id: id("finding", index + 1),
  deviceId: byName(row.deviceName).id,
  toolId: byDomain(row.domain).id,
  connectionCount: row.connectionCount,
  dataVolumeBytes: row.dataVolumeBytes,
  confidence: row.confidence,
  lastSeen: row.lastSeen,
  coverageNote: "Monitored (proxy active)",
  createdAt: daysAgo(10),
}));

const connectionEvents: ConnectionEvent[] = findings.flatMap((finding, fIndex) => {
  const count = Math.min(finding.connectionCount, 12);
  return Array.from({ length: count }, (_, i) => ({
    id: id("event", fIndex * 20 + i + 1),
    findingId: finding.id,
    occurredAt: daysAgo(Math.floor(i * 0.6), 8 + (i % 10)),
    bytesSent: Math.floor(finding.dataVolumeBytes / count),
  }));
});

const usageTrends: UsageTrend[] = Array.from({ length: 30 }, (_, i) => {
  const dayIndex = 29 - i;
  const base = 80 + Math.sin(i / 3) * 30;
  return {
    id: id("trend", i + 1),
    day: dayString(dayIndex),
    connectionCount: Math.round(base + (i % 5) * 12 + ((i * 17) % 40)),
  };
});

export const store = {
  devices,
  aiTools,
  findings,
  connectionEvents,
  usageTrends,
};
