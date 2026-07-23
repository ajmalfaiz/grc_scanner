import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/test/next-navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

describe("AppSidebar", () => {
  it("lists Discovery scanner navigation only", () => {
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Data discovery")).toBeInTheDocument();
    expect(screen.getByText("Saved connections")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });
});
