import type { ConnectorId } from "@/lib/discovery-mock-data";

// Every connector is live — no connector shows modeled/mock scan results.
const LIVE_CONNECTORS = new Set<ConnectorId>([
  "postgres",
  "mysql",
  "mongodb",
  "file-server",
  "server",
  "saas",
  "email",
  "backups",
]);

export function supportsLiveDiscovery(connectorId: ConnectorId): boolean {
  return LIVE_CONNECTORS.has(connectorId);
}

/** Connectors with a "list databases" endpoint + all/selected database picker. */
const MULTI_DATABASE_CONNECTORS = new Set<ConnectorId>(["postgres", "mysql"]);

export function supportsDatabasePicker(connectorId: ConnectorId): boolean {
  return MULTI_DATABASE_CONNECTORS.has(connectorId);
}
