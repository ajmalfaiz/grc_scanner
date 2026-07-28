import { FolderOpen } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testFileServerConnection } from "@/lib/discovery/file-server/connect";
import {
  normalizeFileServerScopeValues,
  runFileServerScan,
  validateFileServerConnectionValues,
} from "@/lib/discovery/file-server/scan";

export const fileServerConnector: DiscoveryConnector = {
  id: "file-server",
  capabilities: [
    "connection_test",
    "metadata_catalog",
    "name_triage",
    "content_sampling",
    "structured_coverage",
  ],
  async testConnection(connection) {
    const values = validateFileServerConnectionValues(connection);
    const result = await testFileServerConnection(values);
    return {
      ok: true as const,
      message: result.message,
      details: result.details,
    };
  },
  async scan(connection, scope) {
    const values = validateFileServerConnectionValues(connection);
    const scopeValues = normalizeFileServerScopeValues(scope);
    const result = await runFileServerScan(values, scopeValues);
    return {
      id: "file-server",
      name: "File server",
      icon: FolderOpen,
      scopeLabel: result.scopeLabel,
      scopeValue: result.scopeValue,
      findings: result.findings,
      coverageLine: result.coverageLine,
      coverage: result.coverage,
      coverageIssues: result.coverageIssues,
      scanRun: result.scanRun,
      methodNote: result.methodNote,
    };
  },
};
