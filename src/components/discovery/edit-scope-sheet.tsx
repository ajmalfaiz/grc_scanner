"use client";

import { useMemo, useState } from "react";

import { DiscoveryFieldControl } from "@/components/discovery/discovery-field-control";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildScopeInitialValues,
  coverageModeOptions,
  getVisibleScopeFields,
  isScopeReady,
  type CoverageMode,
} from "@/lib/discovery-scan-scope";
import type { ConnectorId } from "@/lib/discovery-mock-data";
import {
  type SavedConnection,
  updateSavedConnection,
} from "@/lib/saved-connections";
import { cn } from "@/lib/utils";

export function EditScopeSheet({
  open,
  onOpenChange,
  saved,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: SavedConnection;
  onSaved: (next: SavedConnection, rescanned: boolean) => void;
}) {
  const connectorId = saved.connectorId as ConnectorId;
  const [values, setValues] = useState(() => ({
    ...buildScopeInitialValues(connectorId),
    ...saved.scopeValues,
  }));
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setValues({
      ...buildScopeInitialValues(connectorId),
      ...saved.scopeValues,
    });
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const visible = useMemo(
    () => getVisibleScopeFields(connectorId, values),
    [connectorId, values],
  );
  const canSubmit = isScopeReady(connectorId, values);
  const coverageMode = (values.coverageMode ?? "sample") as CoverageMode;

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function persist(wantRescan: boolean) {
    if (!canSubmit) return;
    const next = updateSavedConnection({
      id: saved.id,
      scopeValues: values,
      touchScan: false,
    });
    if (!next) return;
    onSaved(next, wantRescan);
    // When rescanning, parent may open the credentials panel — avoid
    // onOpenChange(false) racing and clearing that panel.
    if (!wantRescan) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>What to scan</SheetTitle>
          <SheetDescription>
            Adjust scan intensity and sampling for {saved.label}. Changes apply
            to the next rescan.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
              {coverageModeOptions.map((option) => {
                const selected = coverageMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue("coverageMode", option.value)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-foreground/25",
                    )}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {option.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 content-start gap-x-3 gap-y-2.5 sm:grid-cols-2">
              {visible.map((field) => (
                <DiscoveryFieldControl
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(next) => setValue(field.name, next)}
                  idPrefix="edit-scope"
                />
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => persist(false)}
          >
            Save
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => persist(true)}
          >
            Save & rescan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
