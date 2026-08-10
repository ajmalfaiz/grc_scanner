import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/next-navigation";
import { mockReplace } from "@/test/next-navigation";
import { SavedConnectionWorkspace } from "@/components/discovery/saved-connection-workspace";
import { runDiscoveryScanJob } from "@/lib/discovery-scan-client";
import {
  resetSavedConnectionsStoreForTests,
  upsertSavedConnection,
} from "@/lib/saved-connections";

const scanResult = {
  scopeLabel: "Tables catalogued",
  scopeValue: 3,
  findings: [
    {
      location: "public.users.email",
      piiType: "Email",
      confidence: "high" as const,
      detectedVia: "both" as const,
    },
  ],
  coverage: {
    assetsDiscovered: 3,
    assetsScanned: 2,
    assetsSkipped: 1,
    assetsPartial: 0,
    assetsCapped: 0,
    fieldsScanned: 4,
    sampledRecords: 200,
    matchedRecords: 1,
    rawValuesStored: false as const,
  },
  coverageIssues: [
    {
      asset: "public.audit_logs",
      status: "permission_denied" as const,
      reason: "permission denied",
      estimatedRecords: 1000,
    },
  ],
  coverageLine:
    "All 3 scoped tables were sampled — sampled tables used the selected 1% row target",
  methodNote: "live postgres scan",
};

vi.mock("@/lib/discovery-scan-client", () => ({
  runDiscoveryScanJob: vi.fn(async () => scanResult),
}));

describe("SavedConnectionWorkspace", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
    mockReplace.mockClear();
    vi.mocked(runDiscoveryScanJob).mockClear();
    vi.useRealTimers();
  });

  it("shows not-found when the id is missing", () => {
    render(<SavedConnectionWorkspace id="missing" />);
    expect(screen.getByText(/connection not found/i)).toBeInTheDocument();
  });

  it("shows cached findings and opens edit panels without stepper chrome", async () => {
    const user = userEvent.setup();
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        database: "hr",
        username: "u",
        password: "",
        port: "5432",
        sslMode: "prefer",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        nameTriage: "heuristics_llm",
        sampleMethod: "random",
        contentTargets: "ranked_plus_freetext",
        excludeSystemSchemas: "yes",
      },
      lastScanResult: scanResult,
    });

    render(<SavedConnectionWorkspace id={saved.id} />);

    expect(screen.queryByText(/step \d of \d/i)).not.toBeInTheDocument();
    expect(screen.getByText(/postgres · localhost \/ hr/i)).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /coverage gaps/i }));
    expect(
      screen.getByRole("heading", { name: /coverage gaps/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("public.audit_logs")).toBeInTheDocument();
    expect(screen.getAllByText("permission denied")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /close/i }));

    await user.click(screen.getByRole("button", { name: /edit connection/i }));
    expect(
      screen.getByRole("heading", { name: /edit connection/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & rescan/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await user.click(screen.getByRole("button", { name: /what to scan/i }));
    expect(
      screen.getByRole("heading", { name: /what to scan/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when postgres has no cached scan yet", () => {
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        database: "hr",
        username: "u",
        password: "",
        port: "5432",
        sslMode: "prefer",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
      },
    });

    render(<SavedConnectionWorkspace id={saved.id} />);
    expect(screen.getByText(/no scan results yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });

  it("opens the initial panel from the query", async () => {
    const user = userEvent.setup();
    const saved = upsertSavedConnection({
      connectorId: "mysql",
      connectionValues: {
        host: "db",
        database: "app",
        username: "u",
        password: "",
        port: "3306",
        sslMode: "preferred",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        sampleMethod: "random",
        nameTriage: "heuristics",
        contentTargets: "ranked_only",
        excludeSystemSchemas: "yes",
      },
    });

    render(
      <SavedConnectionWorkspace id={saved.id} initialPanel="scope" />,
    );

    expect(
      screen.getByRole("heading", { name: /what to scan/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockReplace).toHaveBeenCalledWith(`/discovery/saved/${saved.id}`);
  });

  it("opens credentials panel when rescanning without stored secrets", async () => {
    const user = userEvent.setup();
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        host: "localhost",
        database: "hr",
        username: "u",
        password: "",
        port: "5432",
        sslMode: "prefer",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        nameTriage: "heuristics_llm",
        sampleMethod: "random",
        contentTargets: "ranked_plus_freetext",
        excludeSystemSchemas: "yes",
      },
      lastScanResult: scanResult,
    });

    render(<SavedConnectionWorkspace id={saved.id} />);

    expect(
      screen.getByText(/password \/ keys not saved/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^rescan$/i }));
    expect(
      screen.getByRole("heading", { name: /enter credentials to rescan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: /save password \/ keys in this browser/i,
      }),
    ).toBeInTheDocument();
  });

  it("asks for the connection string again when that was the original input", async () => {
    const user = userEvent.setup();
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      connectionValues: {
        connectionMode: "connectionString",
        connectionString:
          "postgresql://reader:secret@db.local:6543/hr?sslmode=require",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        nameTriage: "heuristics_llm",
        sampleMethod: "random",
        contentTargets: "ranked_plus_freetext",
        excludeSystemSchemas: "yes",
      },
      lastScanResult: scanResult,
    });

    render(<SavedConnectionWorkspace id={saved.id} />);

    await user.click(screen.getByRole("button", { name: /^rescan$/i }));
    expect(screen.getByLabelText(/^connection string/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/^connection string/i),
      "postgresql://reader:new-secret@db.local:6543/hr?sslmode=require",
    );
    await user.click(screen.getByRole("button", { name: /^rescan$/i }));

    await waitFor(() => {
      expect(runDiscoveryScanJob).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorId: "postgres",
          connectionValues: expect.objectContaining({
            connectionMode: "connectionString",
            connectionString:
              "postgresql://reader:new-secret@db.local:6543/hr?sslmode=require",
          }),
        }),
      );
    });
  });

  it("rescans immediately when secrets were explicitly saved", async () => {
    const user = userEvent.setup();
    const saved = upsertSavedConnection({
      connectorId: "postgres",
      storeSecrets: true,
      connectionValues: {
        host: "localhost",
        database: "hr",
        username: "u",
        password: "secret",
        port: "5432",
        sslMode: "prefer",
      },
      scopeValues: {
        coverageMode: "sample",
        samplingRate: "1",
        nameTriage: "heuristics_llm",
        sampleMethod: "random",
        contentTargets: "ranked_plus_freetext",
        excludeSystemSchemas: "yes",
      },
      lastScanResult: scanResult,
    });

    render(<SavedConnectionWorkspace id={saved.id} />);

    await user.click(screen.getByRole("button", { name: /^rescan$/i }));
    expect(
      screen.queryByRole("heading", { name: /enter credentials to rescan/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/scan refreshed with the current connection/i),
      ).toBeInTheDocument();
    });
  });
});
