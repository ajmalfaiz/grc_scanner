import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanResultView } from "@/components/discovery/scan-result";
import "@/test/next-navigation";

describe("ScanResultView", () => {
  it("does not show static findings for postgres", () => {
    render(<ScanResultView connectorId="postgres" />);

    expect(
      screen.getByRole("heading", { name: /postgres scan result/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no findings detected/i)).toBeInTheDocument();
    expect(screen.getByText(/run a live postgres scan/i)).toBeInTheDocument();
    expect(screen.queryByText("Aadhaar")).not.toBeInTheDocument();

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/hr\.employees|crm\.contacts|finance\.payroll/);
    expect(body).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
  });

  it("renders detected-via labels for fixture-only connectors", () => {
    render(<ScanResultView connectorId="mysql" />);
    expect(screen.getByText("Sl no.")).toBeInTheDocument();
    expect(screen.getByText("Detected via")).toBeInTheDocument();
    expect(screen.getAllByText(/name \+ content|name triage|content sample/i).length).toBeGreaterThan(0);
  });

  it("explains detected-via details on hover", async () => {
    const user = userEvent.setup();
    render(<ScanResultView connectorId="mysql" />);

    await user.hover(
      screen.getAllByRole("button", {
        name: /detected via name \+ content/i,
      })[0],
    );

    expect(await screen.findByText("What was found")).toBeInTheDocument();
    expect(screen.getByText(/Aadhaar at/i)).toBeInTheDocument();
    expect(screen.getAllByText("users.profile.govt_id").length).toBeGreaterThan(
      1,
    );
    expect(screen.getByText(/metadata looked like pii/i)).toBeInTheDocument();
  });
});
