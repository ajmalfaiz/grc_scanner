import { HardDrive } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testMongoConnection } from "@/lib/discovery/mongodb/connect";
import {
  normalizeMongoScopeValues,
  runMongoScan,
  safeMongoScanErrorMessage,
  validateMongoConnectionValues,
} from "@/lib/discovery/mongodb/scan";

export const mongodbConnector: DiscoveryConnector = {
  id: "mongodb",
  capabilities: [
    "connection_test",
    "metadata_catalog",
    "name_triage",
    "content_sampling",
    "structured_coverage",
  ],
  async testConnection(connection) {
    try {
      const values = validateMongoConnectionValues(connection);
      const result = await testMongoConnection(values);
      return {
        ok: true as const,
        message: `Connected to MongoDB ${result.serverVersion} at ${values.host}:${values.port}`,
        details: { host: values.host, database: values.database },
      };
    } catch (error) {
      throw new Error(safeMongoScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateMongoConnectionValues(connection);
      const scopeValues = normalizeMongoScopeValues(scope);
      const result = await runMongoScan(values, scopeValues);
      return {
        id: "mongodb",
        name: "MongoDB",
        icon: HardDrive,
        scopeLabel: result.scopeLabel,
        scopeValue: result.scopeValue,
        findings: result.findings,
        coverageLine: result.coverageLine,
        coverage: result.coverage,
        coverageIssues: result.coverageIssues,
        scanRun: result.scanRun,
        methodNote: result.methodNote,
      };
    } catch (error) {
      throw new Error(safeMongoScanErrorMessage(error));
    }
  },
};
