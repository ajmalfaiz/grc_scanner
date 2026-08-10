import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScanResultView } from "@/components/discovery/scan-result";
import "@/test/next-navigation";

describe("ScanResultView", () => {
  it("does not show static findings for postgres", () => {
    render(<ScanResultView connectorId="postgres" />);

    expect(
      screen.getByRole("heading", { name: /postgres scan result/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no findings detected/i)).toBeInTheDocument();
    expect(screen.getByText(/run a live scan/i)).toBeInTheDocument();
    expect(screen.queryByText("Aadhaar")).not.toBeInTheDocument();

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/hr\.employees|crm\.contacts|finance\.payroll/);
    expect(body).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
  });

  it("shows the same empty, scan-only state for every other connector — no mock/fixture data anywhere", () => {
    for (const connectorId of [
      "mysql",
      "mongodb",
      "file-server",
      "server",
      "saas",
      "email",
      "backups",
    ] as const) {
      const { unmount } = render(<ScanResultView connectorId={connectorId} />);
      expect(screen.getByText(/no findings detected/i)).toBeInTheDocument();
      expect(screen.getByText(/run a live scan/i)).toBeInTheDocument();
      unmount();
    }
  });
});
