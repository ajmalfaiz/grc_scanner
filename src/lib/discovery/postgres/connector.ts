import { Database } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import {
  normalizePostgresScopeValues,
  runPostgresScan,
  safeScanErrorMessage,
  validatePostgresConnectionValues,
} from "@/lib/discovery/postgres/scan";
import { testPostgresConnection } from "@/lib/discovery/postgres/connect";

export const postgresConnector: DiscoveryConnector = {
  id: "postgres",
  capabilities: [
    "connection_test",
    "metadata_catalog",
    "name_triage",
    "content_sampling",
    "structured_coverage",
  ],
  async testConnection(connection) {
    try {
      const values = validatePostgresConnectionValues(connection);
      const result = await testPostgresConnection(values);
      return {
        ok: true as const,
        message: `Connected to Postgres ${result.serverVersion} at ${values.host}`,
        details: { host: values.host, database: values.database },
      };
    } catch (error) {
      throw new Error(safeScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validatePostgresConnectionValues(connection);
      const scopeValues = normalizePostgresScopeValues(scope);
      const result = await runPostgresScan(values, scopeValues, connection);
      return {
        id: "postgres",
        name: "Postgres",
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
      throw new Error(safeScanErrorMessage(error));
    }
  },
};
