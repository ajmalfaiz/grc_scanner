"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, ScanSearch } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const discoveryNav = [
  { href: "/discovery", label: "Data discovery", icon: ScanSearch },
  { href: "/discovery/saved", label: "Saved connections", icon: Bookmark },
];

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  // Keep Data discovery active during the scan wizard, but not on Saved.
  if (href === "/discovery") {
    return (
      pathname === "/discovery" ||
      pathname.startsWith("/discovery/connect") ||
      pathname.startsWith("/discovery/scope") ||
      pathname.startsWith("/discovery/scan")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItems({
  items,
}: {
  items: { href: string; label: string; icon: typeof ScanSearch }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = isNavActive(item.href, pathname);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={active}
              tooltip={item.label}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3 border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            J
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-primary">
              Jethur
            </p>
            <p className="truncate font-heading text-sm font-semibold">
              AI Governance
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discovery</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={discoveryNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3" />
      <SidebarRail />
    </Sidebar>
  );
}
