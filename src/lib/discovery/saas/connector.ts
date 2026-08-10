import { Cloud } from "lucide-react";

import { testSaasConnection } from "@/lib/discovery/saas/client";
import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import {
  normalizeSaasScopeValues,
  runSaasScan,
  safeSaasScanErrorMessage,
  validateSaasConnectionValues,
} from "@/lib/discovery/saas/scan";

export const saasConnector: DiscoveryConnector = {
  id: "saas",
  capabilities: ["connection_test", "metadata_catalog", "name_triage", "content_sampling", "structured_coverage"],
  async testConnection(connection) {
    try {
      const values = validateSaasConnectionValues(connection);
      const result = await testSaasConnection(values);
      return { ok: true as const, message: result.message, details: result.details };
    } catch (error) {
      throw new Error(safeSaasScanErrorMessage(error));
    }
  },
  async scan(connection, scope) {
    try {
      const values = validateSaasConnectionValues(connection);
      const scopeValues = normalizeSaasScopeValues(scope);
      const result = await runSaasScan(values, scopeValues);
      return {
        id: "saas",
        name: "SaaS / business app",
        icon: Cloud,
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
      throw new Error(safeSaasScanErrorMessage(error));
    }
  },
};
