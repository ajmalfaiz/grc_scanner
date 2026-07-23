import { describe, expect, it } from "vitest";
import { cn, coverageReasonLabels, formatBytes, formatNumber } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
      "text-sm font-medium",
    );
  });
});

describe("formatBytes", () => {
  it("formats bytes, KB, and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("~2.0 MB");
  });
});

describe("formatNumber", () => {
  it("formats with en-IN grouping", () => {
    expect(formatNumber(1200)).toBe("1,200");
  });
});

describe("coverageReasonLabels", () => {
  it("covers all known coverage reasons", () => {
    expect(coverageReasonLabels.unmanaged_device).toMatch(/Unmanaged/);
    expect(coverageReasonLabels.off_network).toBe("Off-network");
    expect(coverageReasonLabels.proxy_not_configured).toMatch(/Proxy/);
    expect(coverageReasonLabels.unknown).toMatch(/unknown/i);
  });
});
