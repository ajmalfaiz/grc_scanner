import { Database } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testMysqlConnection } from "@/lib/discovery/mysql/connect";
import {
  normalizeMysqlScopeValues,
  runMysqlScan,
  safeMysqlScanErrorMessage,
  validateMysqlConnectionValues,
} from "@/lib/discovery/mysql/scan";

export const mysqlConnector: DiscoveryConnector = {
  id: "mysql",
  capabilities: [
    "connection_test",
    "metadata_catalog",
    "name_triage",
    "content_sampling",
    "structured_coverage",
  ],
  async testConnection(connection) {
    try {
      const values = validateMysqlConnectionValues(connection);
      const result = await testMysqlConnection(values);
      return {
        ok: true as const,
        message: `Connected to MySQL ${result.serverVersion} at ${values.host}:${values.port}`,
        details: { host: values.host },
      };
    } catch (error) {
      throw new Error(safeMysqlScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateMysqlConnectionValues(connection);
      const scopeValues = normalizeMysqlScopeValues(scope);
      const result = await runMysqlScan(values, scopeValues);
      return {
        id: "mysql",
        name: "MySQL",
        icon: Database,
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
      throw new Error(safeMysqlScanErrorMessage(error));
    }
  },
};
