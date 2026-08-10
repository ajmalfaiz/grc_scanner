import type { ConnectorId } from "@/lib/discovery-mock-data";
import type { DiscoveryConnector } from "@/lib/discovery/connectors";
import { backupsConnector } from "@/lib/discovery/backups/connector";
import { emailConnector } from "@/lib/discovery/email/connector";
import { fileServerConnector } from "@/lib/discovery/file-server/connector";
import { mongodbConnector } from "@/lib/discovery/mongodb/connector";
import { mysqlConnector } from "@/lib/discovery/mysql/connector";
import { postgresConnector } from "@/lib/discovery/postgres/connector";
import { saasConnector } from "@/lib/discovery/saas/connector";
import { serverConnector } from "@/lib/discovery/server/connector";

/**
 * Single source of truth mapping every connector id to its real
 * implementation — used by the background job runner (and anything else
 * that needs to run a scan without going through an HTTP round trip to
 * this app's own API routes).
 */
export const connectorRegistry: Record<ConnectorId, DiscoveryConnector> = {
  postgres: postgresConnector,
  mysql: mysqlConnector,
  mongodb: mongodbConnector,
  "file-server": fileServerConnector,
  server: serverConnector,
  saas: saasConnector,
  email: emailConnector,
  backups: backupsConnector,
};

export function getConnector(id: ConnectorId): DiscoveryConnector {
  return connectorRegistry[id];
}
