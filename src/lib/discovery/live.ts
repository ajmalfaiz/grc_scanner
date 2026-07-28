import type { ConnectorId } from "@/lib/discovery-mock-data";

const LIVE_CONNECTORS = new Set<ConnectorId>(["postgres", "file-server"]);

export function supportsLiveDiscovery(connectorId: ConnectorId): boolean {
  return LIVE_CONNECTORS.has(connectorId);
}
