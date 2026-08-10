import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/next-navigation";
import { mockPush } from "@/test/next-navigation";
import { ScanScopeForm } from "@/components/discovery/scan-scope-form";
import { runDiscoveryScanJob } from "@/lib/discovery-scan-client";
import {
  listSavedConnections,
  resetSavedConnectionsStoreForTests,
  saveDiscoveryDraft,
} from "@/lib/saved-connections";

const scanResult = {
  scopeLabel: "Tables catalogued",
  scopeValue: 2,
  findings: [
    {
      location: "public.users.email",
      piiType: "Email",
      confidence: "high" as const,
      detectedVia: "both" as const,
    },
  ],
  coverageLine:
    "All 2 scoped tables were sampled — sampled tables used the selected 1% row target",
  methodNote: "live scan",
};

vi.mock("@/lib/discovery-scan-client", () => ({
  runDiscoveryScanJob: vi.fn(async () => scanResult),
}));

describe("ScanScopeForm", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
    mockPush.mockClear();
    vi.mocked(runDiscoveryScanJob).mockResolvedValue(scanResult);
    saveDiscoveryDraft({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        port: "5432",
        database: "hr",
        username: "reader",
        password: "secret",
        sslMode: "prefer",
      },
    });
  });

  it("renders sampled vs deep options without pipeline info cards", () => {
    render(<ScanScopeForm connectorId="postgres" />);
    expect(screen.getByRole("heading", { name: /what to scan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sampled scan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deep scan/i })).toBeInTheDocument();
    expect(screen.queryByText(/^1\. Catalog$/i)).not.toBeInTheDocument();
  });

  it("runs a live scan, saves the connection, and navigates to the workspace", async () => {
    const user = userEvent.setup();
    render(<ScanScopeForm connectorId="postgres" />);

    await user.click(screen.getByRole("button", { name: /run scan & save/i }));

    await waitFor(() => {
      expect(listSavedConnections()).toHaveLength(1);
    });

    const saved = listSavedConnections();
    expect(saved[0].connectorId).toBe("postgres");
    expect(saved[0].lastScanResult?.findings[0].piiType).toBe("Email");
    expect(mockPush).toHaveBeenCalledWith(`/discovery/saved/${saved[0].id}`);
  });

  it("shows an animated scanning screen while the scan is running", async () => {
    const user = userEvent.setup();
    vi.mocked(runDiscoveryScanJob).mockImplementationOnce(
      () => new Promise(() => {}),
    );
    render(<ScanScopeForm connectorId="postgres" />);

    await user.click(screen.getByRole("button", { name: /run scan & save/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/scanning postgres/i);
    expect(
      screen.getByText(/opening a read-only connection/i),
    ).toBeInTheDocument();
  });

  it("runs a live file-server scan", async () => {
    const user = userEvent.setup();
    saveDiscoveryDraft({
      connectorId: "file-server",
      connectionValues: {
        protocol: "sftp",
        host: "files.local",
        port: "22",
        username: "svc",
        password: "secret",
        basePath: "/shared",
      },
    });
    vi.mocked(runDiscoveryScanJob).mockResolvedValue({
      ...scanResult,
      scopeLabel: "Files inventoried",
      findings: [
        {
          location: "/shared/hr/employees.csv",
          piiType: "Email",
          confidence: "high",
          detectedVia: "content_sample",
        },
      ],
    });

    render(<ScanScopeForm connectorId="file-server" />);
    await user.click(screen.getByRole("button", { name: /run scan & save/i }));

    await waitFor(() => {
      expect(runDiscoveryScanJob).toHaveBeenCalledWith(
        expect.objectContaining({ connectorId: "file-server" }),
      );
    });
    expect(listSavedConnections()[0]?.connectorId).toBe("file-server");
  });
});
