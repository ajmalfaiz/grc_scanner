"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, FolderOpen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getScanResult } from "@/lib/discovery-mock-data";
import {
  formatScannedAt,
  getSavedConnectionsSnapshot,
  removeSavedConnection,
  subscribeSavedConnections,
  type SavedConnection,
} from "@/lib/saved-connections";

const EMPTY_SAVED_SERVER: SavedConnection[] = [];

export function SavedConnectionsList() {
  const router = useRouter();
  const items = useSyncExternalStore(
    subscribeSavedConnections,
    getSavedConnectionsSnapshot,
    () => EMPTY_SAVED_SERVER,
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
          <Bookmark className="size-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No saved connections yet
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            After you run a discovery scan, the connection is saved in this
            browser. Passwords and keys are stored only if you explicitly agree.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/discovery" />}>
          Start a discovery scan
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = getScanResult(item.connectorId)?.icon;
        const href = `/discovery/saved/${item.id}`;

        return (
          <li key={item.id}>
            <div
              role="link"
              tabIndex={0}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                router.push(href);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(href);
                }
              }}
            >
              {Icon ? (
                <Icon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.connectionSummary}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.scopeSummary} · Last scan{" "}
                  {formatScannedAt(item.lastScannedAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.storeSecrets
                    ? "Password / keys remembered"
                    : "Asks for password / key on rescan"}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <Button
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(href);
                    }}
                  >
                    <FolderOpen data-icon="inline-start" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSavedConnection(item.id);
                    }}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
