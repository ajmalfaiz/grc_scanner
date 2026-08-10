import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@/test/next-navigation";
import { mockPush } from "@/test/next-navigation";
import { ConnectorPicker } from "@/components/discovery/connector-picker";
import { resetSavedConnectionsStoreForTests } from "@/lib/saved-connections";

describe("ConnectorPicker", () => {
  beforeEach(() => {
    resetSavedConnectionsStoreForTests();
    mockPush.mockClear();
  });

  it("renders every connector as live — no disabled placeholders", () => {
    render(<ConnectorPicker />);
    expect(screen.getByRole("heading", { name: /choose a connector/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /postgres/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /backups/i })).toBeEnabled();
    expect(document.querySelector("[aria-disabled='true']")).toBeNull();
  });

  it("keeps Continue disabled until a connector is selected", async () => {
    const user = userEvent.setup();
    render(<ConnectorPicker />);

    const continueBtn = screen.getByRole("button", { name: /^continue$/i });
    expect(continueBtn).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /postgres/i }));
    expect(
      screen.getByRole("button", { name: /continue with postgres/i }),
    ).toBeEnabled();
  });

  it("navigates to connect step for the selected connector", async () => {
    const user = userEvent.setup();
    render(<ConnectorPicker />);

    await user.click(screen.getByRole("button", { name: /mysql/i }));
    await user.click(screen.getByRole("button", { name: /continue with mysql/i }));

    expect(mockPush).toHaveBeenCalledWith("/discovery/connect/mysql");
  });
});
