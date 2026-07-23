import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/next-navigation";
import { mockPush } from "@/test/next-navigation";
import { SavedConnectionsList } from "@/components/discovery/saved-connections-list";
import {
  listSavedConnections,
  resetSavedConnectionsStoreForTests,
  upsertSavedConnection,
} from "@/lib/saved-connections";

describe("SavedConnectionsList", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
    mockPush.mockClear();
  });

  it("shows empty state when there are no saved connections", () => {
    render(<SavedConnectionsList />);
    expect(screen.getByText(/no saved connections yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start a discovery scan/i }),
    ).toHaveAttribute("href", "/discovery");
  });

  it("opens from the Open button or card click, and only exposes Open and Remove", async () => {
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
      scopeValues: { coverageMode: "sample", samplingRate: "1" },
    });

    render(<SavedConnectionsList />);
    expect(screen.getByText(/postgres · localhost \/ hr/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /what to scan/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit connection/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^open$/i }));
    expect(mockPush).toHaveBeenCalledWith(`/discovery/saved/${saved.id}`);

    mockPush.mockClear();
    await user.click(screen.getByText(/postgres · localhost \/ hr/i));
    expect(mockPush).toHaveBeenCalledWith(`/discovery/saved/${saved.id}`);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(listSavedConnections()).toHaveLength(0);
  });
});
