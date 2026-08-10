import { Server } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testServerConnection } from "@/lib/discovery/server/connect";
import {
  normalizeServerScopeValues,
  runServerScan,
  safeServerErrorMessage,
  validateServerConnectionValues,
} from "@/lib/discovery/server/scan";

export const serverConnector: DiscoveryConnector = {
  id: "server",
  capabilities: ["connection_test", "metadata_catalog", "content_sampling", "structured_coverage"],
  async testConnection(connection) {
    try {
      const values = validateServerConnectionValues(connection);
      const result = await testServerConnection(values);
      return { ok: true as const, message: result.message, details: result.details };
    } catch (error) {
      throw new Error(safeServerErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateServerConnectionValues(connection);
      const scopeValues = normalizeServerScopeValues(scope);
      const result = await runServerScan(values, scopeValues);
      return {
        id: "server",
        name: "Server",
        icon: Server,
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
      throw new Error(safeServerErrorMessage(error));
    }
  },
};
