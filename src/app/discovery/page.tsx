import { ConnectorPicker } from "@/components/discovery/connector-picker";

export default function DiscoveryInputPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
      <ConnectorPicker />
    </main>
  );
}
