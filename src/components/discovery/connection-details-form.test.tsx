import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/next-navigation";
import { mockPush } from "@/test/next-navigation";
import { ConnectionDetailsForm } from "@/components/discovery/connection-details-form";
import {
  loadDiscoveryDraft,
  resetSavedConnectionsStoreForTests,
} from "@/lib/saved-connections";

const testDiscoveryConnection = vi.fn();
const listDiscoveryDatabases = vi.fn();

vi.mock("@/lib/discovery-scan-client", () => ({
  testDiscoveryConnection: (...args: unknown[]) =>
    testDiscoveryConnection(...args),
  listDiscoveryDatabases: (...args: unknown[]) =>
    listDiscoveryDatabases(...args),
  runDiscoveryScan: vi.fn(),
}));

describe("ConnectionDetailsForm", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
    mockPush.mockClear();
    testDiscoveryConnection.mockReset();
    listDiscoveryDatabases.mockReset();
  });

  it("requires postgres credentials and a database selection before continue", async () => {
    const user = userEvent.setup();
    listDiscoveryDatabases.mockResolvedValue({
      ok: true,
      databases: ["hr", "analytics"],
      message: "Found 2 databases",
    });

    render(<ConnectionDetailsForm connectorId="postgres" />);

    expect(screen.getByRole("heading", { name: /connect postgres/i })).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    const testBtn = screen.getByRole("button", { name: /test connection/i });
    expect(continueBtn).toBeDisabled();
    expect(testBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/^username/i), "reader");
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /load databases/i }));
    await waitFor(() => {
      expect(screen.getByText("hr")).toBeInTheDocument();
    });

    // First available database is auto-selected after load.
    expect(screen.getByRole("checkbox", { name: /hr/i })).toBeChecked();
    expect(continueBtn).toBeEnabled();
    expect(testBtn).toBeEnabled();
    await user.click(continueBtn);

    expect(mockPush).toHaveBeenCalledWith("/discovery/scope/postgres");
    expect(loadDiscoveryDraft()?.connectionValues.databases).toBe("hr");
    expect(loadDiscoveryDraft()?.connectionValues.database).toBe("hr");
    expect(loadDiscoveryDraft()?.connectionValues.password).toBe("");
  });

  it("allows analysing all databases after credentials are entered", async () => {
    const user = userEvent.setup();
    render(<ConnectionDetailsForm connectorId="postgres" />);

    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.click(screen.getByRole("radio", { name: /all databases/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(mockPush).toHaveBeenCalledWith("/discovery/scope/postgres");
    expect(loadDiscoveryDraft()?.connectionValues.databaseMode).toBe("all");
  });

  it("accepts a postgres connection string before continue", async () => {
    const user = userEvent.setup();
    render(<ConnectionDetailsForm connectorId="postgres" />);

    await user.click(screen.getByLabelText(/connection input/i));
    await user.click(
      await screen.findByRole("option", { name: /connection string/i }),
    );
    expect(screen.getByLabelText(/connection input/i)).toHaveTextContent(
      "Connection string",
    );
    await user.type(
      screen.getByLabelText(/^connection string/i),
      "postgresql://reader:secret@db.local:6543/hr?sslmode=require",
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(mockPush).toHaveBeenCalledWith("/discovery/scope/postgres");
    expect(loadDiscoveryDraft()?.connectionValues).toMatchObject({
      host: "db.local",
      port: "6543",
      database: "hr",
      username: "reader",
      password: "secret",
      sslMode: "require",
      connectionMode: "connectionString",
      connectionString:
        "postgresql://reader:secret@db.local:6543/hr?sslmode=require",
    });
  });

  it("tests the postgres connection and shows success", async () => {
    const user = userEvent.setup();
    testDiscoveryConnection.mockResolvedValue({
      ok: true,
      serverVersion: "16.2",
      message: "Connected successfully (PostgreSQL 16.2)",
    });
    listDiscoveryDatabases.mockResolvedValue({
      ok: true,
      databases: ["hr"],
      message: "Found 1 database",
    });

    render(<ConnectionDetailsForm connectorId="postgres" />);

    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/^password/i), "secret");
    await user.click(screen.getByRole("button", { name: /load databases/i }));
    await waitFor(() => {
      expect(screen.getByText("hr")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/connected successfully \(postgresql 16\.2\)/i),
      ).toBeInTheDocument();
    });
    expect(testDiscoveryConnection).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows an error when the connection test fails", async () => {
    const user = userEvent.setup();
    testDiscoveryConnection.mockRejectedValue(
      new Error("Authentication failed — check username and password"),
    );
    listDiscoveryDatabases.mockResolvedValue({
      ok: true,
      databases: ["hr"],
      message: "Found 1 database",
    });

    render(<ConnectionDetailsForm connectorId="postgres" />);

    await user.type(screen.getByLabelText(/^username/i), "reader");
    await user.type(screen.getByLabelText(/^password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /load databases/i }));
    await waitFor(() => {
      expect(screen.getByText("hr")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });
  });
});
