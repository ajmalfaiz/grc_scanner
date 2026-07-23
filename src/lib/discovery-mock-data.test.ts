import { describe, expect, it } from "vitest";
import {
  connectorCards,
  countNeedsReview,
  detectionMethodLabels,
  getScanResult,
  scanResults,
} from "@/lib/discovery-mock-data";

describe("discovery mock data", () => {
  it("exposes six enabled connectors and five disabled", () => {
    const enabled = connectorCards.filter((c) => c.enabled);
    const disabled = connectorCards.filter((c) => !c.enabled);
    expect(enabled).toHaveLength(6);
    expect(disabled).toHaveLength(5);
    expect(enabled.every((c) => c.scanId)).toBe(true);
  });

  it("has scan results for every enabled connector", () => {
    for (const card of connectorCards.filter((c) => c.enabled)) {
      const result = getScanResult(card.scanId!);
      expect(result).toBeDefined();
      if (card.scanId === "postgres") {
        expect(result!.findings).toHaveLength(0);
        expect(result!.methodNote).toMatch(/live scanner/i);
      } else {
        expect(result!.findings.length).toBeGreaterThanOrEqual(4);
      }
      expect(result!.coverageLine.length).toBeGreaterThan(0);
      expect(result!.methodNote.length).toBeGreaterThan(0);
    }
  });

  it("only uses type labels — no Aadhaar-looking digits in findings", () => {
    const digitRuns = /\d{4,}/;
    for (const result of Object.values(scanResults)) {
      for (const finding of result.findings) {
        expect(finding.piiType).not.toMatch(digitRuns);
        expect(finding.detectedVia in detectionMethodLabels).toBe(true);
        expect(["high", "medium"]).toContain(finding.confidence);
      }
    }
  });

  it("counts medium-confidence findings for needs review", () => {
    const findings = [
      { confidence: "high" as const },
      { confidence: "medium" as const },
      { confidence: "medium" as const },
    ];
    expect(
      countNeedsReview(
        findings.map((f) => ({
          location: "x",
          piiType: "Email",
          confidence: f.confidence,
          detectedVia: "both" as const,
        })),
      ),
    ).toBe(2);
  });

  it("returns undefined for unknown connector ids", () => {
    expect(getScanResult("not-a-connector")).toBeUndefined();
  });
});
