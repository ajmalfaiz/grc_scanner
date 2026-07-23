import type {
  ConnectorId,
  ConnectorScanResult,
} from "@/lib/discovery-mock-data";

export type DiscoveryConnectorCapability =
  | "connection_test"
  | "metadata_catalog"
  | "name_triage"
  | "content_sampling"
  | "structured_coverage";

export type DiscoveryConnectionInput = Record<string, string>;
export type DiscoveryScopeInput = Record<string, string>;

export type DiscoveryConnectionTest = {
  ok: true;
  message: string;
  details?: Record<string, string>;
};

export type DiscoveryConnector = {
  id: ConnectorId;
  capabilities: DiscoveryConnectorCapability[];
  testConnection?: (
    connection: DiscoveryConnectionInput,
  ) => Promise<DiscoveryConnectionTest>;
  scan: (
    connection: DiscoveryConnectionInput,
    scope: DiscoveryScopeInput,
  ) => Promise<ConnectorScanResult>;
};

