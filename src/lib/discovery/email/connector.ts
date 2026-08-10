import { Mail } from "lucide-react";

import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { testEmailConnection } from "@/lib/discovery/email/connect";
import {
  normalizeEmailScopeValues,
  runEmailScan,
  safeEmailScanErrorMessage,
  validateEmailConnectionValues,
} from "@/lib/discovery/email/scan";

export const emailConnector: DiscoveryConnector = {
  id: "email",
  capabilities: ["connection_test", "metadata_catalog", "content_sampling", "structured_coverage"],
  async testConnection(connection) {
    try {
      const values = validateEmailConnectionValues(connection);
      const result = await testEmailConnection(values);
      return {
        ok: true as const,
        message: result.message,
        details: { host: values.host, mailboxes: values.mailboxes.join(", ") },
      };
    } catch (error) {
      throw new Error(safeEmailScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateEmailConnectionValues(connection);
      const scopeValues = normalizeEmailScopeValues(scope);
      const result = await runEmailScan(values, scopeValues);
      return {
        id: "email",
        name: "Email",
        icon: Mail,
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
      throw new Error(safeEmailScanErrorMessage(error));
    }
  },
};
