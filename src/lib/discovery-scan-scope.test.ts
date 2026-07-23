import { describe, expect, it } from "vitest";
import {
  buildScopeInitialValues,
  coverageModeOptions,
  getScanPipeline,
  getScopeFields,
  getVisibleScopeFields,
  isScopeReady,
  scanPipelineByConnector,
  scopeFieldsByConnector,
} from "@/lib/discovery-scan-scope";
import type { ConnectorId } from "@/lib/discovery-mock-data";

describe("discovery scan scope", () => {
  const connectors = Object.keys(scopeFieldsByConnector) as ConnectorId[];

  it("defines sample and deep coverage modes", () => {
    expect(coverageModeOptions.map((o) => o.value)).toEqual([
      "sample",
      "full",
    ]);
  });

  it("defines a 4-stage pipeline for every connector", () => {
    for (const id of connectors) {
      expect(getScanPipeline(id)).toHaveLength(4);
      expect(scanPipelineByConnector[id][0].title).toMatch(/1\./);
    }
  });

  it("defaults postgres to sampled scan and is ready with defaults", () => {
    const values = buildScopeInitialValues("postgres");
    expect(values.coverageMode).toBe("sample");
    expect(values.samplingRate).toBe("1");
    expect(isScopeReady("postgres", values)).toBe(true);
  });

  it("shows row sampling rate only in sample mode for postgres", () => {
    const values = buildScopeInitialValues("postgres");
    const sampleNames = getVisibleScopeFields("postgres", values).map(
      (f) => f.name,
    );
    expect(sampleNames).toContain("samplingRate");
    expect(sampleNames).not.toContain("samplingRateFull");

    values.coverageMode = "full";
    const fullNames = getVisibleScopeFields("postgres", values).map(
      (f) => f.name,
    );
    expect(fullNames).toContain("samplingRateFull");
    expect(fullNames).not.toContain("samplingRate");
    expect(isScopeReady("postgres", values)).toBe(true);
  });

  it("requires coverage mode to be sample or full", () => {
    const values = buildScopeInitialValues("mysql");
    values.coverageMode = "something-else";
    expect(isScopeReady("mysql", values)).toBe(false);
  });

  it("exposes name triage for sql, mongo, and saas connectors", () => {
    for (const id of ["postgres", "mysql", "mongodb", "saas"] as ConnectorId[]) {
      const field = getScopeFields(id).find((f) => f.name === "nameTriage");
      expect(field).toBeDefined();
    }
  });
});
