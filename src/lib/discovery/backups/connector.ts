import { Archive } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testBackupsConnection } from "@/lib/discovery/backups/connect";
import {
  normalizeBackupsScopeValues,
  runBackupsScan,
  safeBackupsScanErrorMessage,
  validateBackupsConnectionValues,
} from "@/lib/discovery/backups/scan";

export const backupsConnector: DiscoveryConnector = {
  id: "backups",
  capabilities: ["connection_test", "metadata_catalog", "content_sampling", "structured_coverage"],
  async testConnection(connection) {
    try {
      const values = validateBackupsConnectionValues(connection);
      const result = await testBackupsConnection(values);
      return { ok: true as const, message: result.message, details: result.details };
    } catch (error) {
      throw new Error(safeBackupsScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateBackupsConnectionValues(connection);
      const scopeValues = normalizeBackupsScopeValues(scope);
      const result = await runBackupsScan(values, scopeValues);
      return {
        id: "backups",
        name: "Backups and archives",
        icon: Archive,
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
      throw new Error(safeBackupsScanErrorMessage(error));
    }
  },
};
