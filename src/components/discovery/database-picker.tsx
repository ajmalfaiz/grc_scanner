"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  formatDatabaseList,
  isDatabaseSelectionReady,
  parseDatabaseList,
  type DatabaseMode,
} from "@/lib/discovery/shared/database-selection";
import { cn } from "@/lib/utils";

/** Generic "which databases to scan" picker — used by Postgres and MySQL. */
export function DatabasePicker({
  values,
  availableDatabases,
  loading,
  error,
  onLoad,
  onChange,
  canLoad,
  className,
}: {
  values: Record<string, string>;
  availableDatabases: string[];
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  onChange: (patch: Record<string, string>) => void;
  canLoad: boolean;
  className?: string;
}) {
  const mode: DatabaseMode = values.databaseMode === "all" ? "all" : "selected";
  const selected = new Set(parseDatabaseList(values.databases));
  const hasList = availableDatabases.length > 0;

  function setMode(next: DatabaseMode) {
    if (next === "all") {
      onChange({
        databaseMode: "all",
        databases: formatDatabaseList(availableDatabases),
        database: availableDatabases[0] ?? values.database ?? "",
      });
      return;
    }
    onChange({
      databaseMode: "selected",
      databases: formatDatabaseList(
        selected.size > 0 ? [...selected] : availableDatabases.slice(0, 1),
      ),
      database: [...selected][0] ?? availableDatabases[0] ?? values.database ?? "",
    });
  }

  function toggleDatabase(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    const list = availableDatabases.filter((db) => next.has(db));
    onChange({
      databaseMode: "selected",
      databases: formatDatabaseList(list),
      database: list[0] ?? name,
    });
  }

  function selectAllListed() {
    onChange({
      databaseMode: "selected",
      databases: formatDatabaseList(availableDatabases),
      database: availableDatabases[0] ?? values.database ?? "",
    });
  }

  function clearSelection() {
    onChange({
      databaseMode: "selected",
      databases: "",
      database: values.database ?? "",
    });
  }

  return (
    <div
      className={cn(
        "sm:col-span-2 flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card/40 p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <Label className="text-xs font-medium text-foreground">
            Databases to analyse
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Enter host and credentials first, then load databases from the
            server.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canLoad || loading}
          onClick={onLoad}
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {loading ? "Loading…" : hasList ? "Refresh" : "Load databases"}
        </Button>
      </div>

      <div
        role="radiogroup"
        aria-label="Database selection mode"
        className="grid gap-2 sm:grid-cols-2"
      >
        {(
          [
            {
              value: "all" as const,
              label: "All databases",
              detail: "Scan every database visible to this role.",
            },
            {
              value: "selected" as const,
              label: "Selected databases",
              detail: "Pick one or more databases from the list below.",
            },
          ] as const
        ).map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors",
                active
                  ? "border-foreground/30 bg-muted/60"
                  : "border-border hover:bg-muted/40",
              )}
              onClick={() => setMode(option.value)}
            >
              <p className="text-sm font-medium text-foreground">
                {option.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {option.detail}
              </p>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!hasList && !loading && !error ? (
        <p className="text-sm text-muted-foreground">
          No databases loaded yet.
        </p>
      ) : null}

      {hasList ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {availableDatabases.length} available
              {mode === "selected"
                ? ` · ${selected.size} selected`
                : " · all will be scanned"}
            </p>
            {mode === "selected" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllListed}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          <ul
            className={cn(
              "max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2",
              mode === "all" && "opacity-70",
            )}
          >
            {availableDatabases.map((name) => {
              const checked = mode === "all" || selected.has(name);
              return (
                <li key={name}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      mode === "selected" && "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-foreground"
                      checked={checked}
                      disabled={mode === "all"}
                      onChange={() => toggleDatabase(name)}
                    />
                    <span className="truncate font-mono text-xs">{name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { isDatabaseSelectionReady };
