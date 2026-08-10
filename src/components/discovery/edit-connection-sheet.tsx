"use client";

import { useMemo, useState } from "react";

import { DatabasePicker, isDatabaseSelectionReady } from "@/components/discovery/database-picker";
import { DiscoveryFieldControl } from "@/components/discovery/discovery-field-control";
import { RememberSecretsConsent } from "@/components/discovery/remember-secrets-consent";
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
  buildInitialValues,
  getConnectionFields,
  getVisibleFields,
} from "@/lib/discovery-connection-fields";
import { listDiscoveryDatabases } from "@/lib/discovery-scan-client";
import type { ConnectorId } from "@/lib/discovery-mock-data";
import { supportsDatabasePicker, supportsLiveDiscovery } from "@/lib/discovery/live";
import { parseDatabaseList } from "@/lib/discovery/shared/database-selection";
import {
  SECRET_FIELD_NAMES,
  areSecretsFilled,
  type SavedConnection,
  updateSavedConnection,
} from "@/lib/saved-connections";

const DATABASE_PICKER_FIELDS = new Set([
  "databaseMode",
  "databases",
  "database",
]);

function buildValues(saved: SavedConnection) {
  const fields = getConnectionFields(saved.connectorId as ConnectorId);
  return {
    fields,
    values: { ...buildInitialValues(fields), ...saved.connectionValues },
  };
}

export function EditConnectionSheet({
  open,
  onOpenChange,
  saved,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: SavedConnection;
  onSaved: (
    next: SavedConnection,
    wantRescan: boolean,
    scanConnectionValues?: Record<string, string>,
  ) => void;
}) {
  const seeded = useMemo(() => buildValues(saved), [saved]);
  const [values, setValues] = useState(seeded.values);
  const [storeSecrets, setStoreSecrets] = useState(saved.storeSecrets);
  const [wasOpen, setWasOpen] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>(() =>
    parseDatabaseList(seeded.values.databases),
  );
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  if (open && !wasOpen) {
    setWasOpen(true);
    const next = buildValues(saved);
    setValues(next.values);
    setStoreSecrets(saved.storeSecrets);
    setAvailableDatabases(parseDatabaseList(next.values.databases));
    setDatabaseError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const fields = seeded.fields;
  const connectorId = saved.connectorId as ConnectorId;
  const showDatabasePicker =
    supportsDatabasePicker(connectorId) && values.connectionMode !== "connectionString";
  const visible = getVisibleFields(fields, values).filter(
    (field) => !showDatabasePicker || !DATABASE_PICKER_FIELDS.has(field.name),
  );

  function nonSecretFieldsReady() {
    const baseReady = visible.every((field) => {
      if (!field.required) return true;
      if (SECRET_FIELD_NAMES.has(field.name)) return true;
      return (values[field.name] ?? "").trim().length > 0;
    });
    if (!baseReady) return false;
    if (!showDatabasePicker) return true;
    return isDatabaseSelectionReady(values);
  }

  const canSave =
    nonSecretFieldsReady() &&
    (!storeSecrets || areSecretsFilled(connectorId, values));

  const canSaveAndRescan =
    nonSecretFieldsReady() && areSecretsFilled(connectorId, values);

  const canLoadDatabases =
    showDatabasePicker &&
    (values.host ?? "").trim().length > 0 &&
    (values.port ?? "").trim().length > 0 &&
    (values.username ?? "").trim().length > 0 &&
    !loadingDatabases;

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function patchValues(patch: Record<string, string>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setDatabaseError(null);
  }

  async function handleLoadDatabases() {
    if (!canLoadDatabases) return;
    setLoadingDatabases(true);
    setDatabaseError(null);
    try {
      const result = await listDiscoveryDatabases({
        connectorId,
        connectionValues: values,
      });
      setAvailableDatabases(result.databases);
      if (values.databaseMode === "all") {
        patchValues({
          databaseMode: "all",
          databases: result.databases.join(", "),
          database: result.databases[0] ?? values.database ?? "",
        });
      } else if (!parseDatabaseList(values.databases).length) {
        const preferred =
          values.database?.trim() &&
          result.databases.includes(values.database.trim())
            ? values.database.trim()
            : result.databases[0];
        if (preferred) {
          patchValues({
            databaseMode: "selected",
            databases: preferred,
            database: preferred,
          });
        }
      }
    } catch (err) {
      setDatabaseError(
        err instanceof Error ? err.message : "Could not list databases",
      );
    } finally {
      setLoadingDatabases(false);
    }
  }

  function persist(wantRescan: boolean) {
    const ready = wantRescan ? canSaveAndRescan : canSave;
    if (!ready) return;
    const next = updateSavedConnection({
      id: saved.id,
      connectionValues: values,
      storeSecrets,
      // Parent runs the live scan for every live connector; avoid a double
      // lastScannedAt update — it gets set again once that scan completes.
      touchScan: wantRescan && !supportsLiveDiscovery(connectorId),
    });
    if (!next) return;
    onSaved(next, wantRescan, wantRescan ? values : undefined);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Edit connection</SheetTitle>
          <SheetDescription>
            Update connector options for {saved.label}. Passwords and keys are
            only kept if you explicitly agree below.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-1 content-start gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {visible.map((field) => {
              const isSecret = SECRET_FIELD_NAMES.has(field.name);
              return (
                <DiscoveryFieldControl
                  key={field.name}
                  field={
                    isSecret
                      ? {
                          ...field,
                          required: storeSecrets || field.required,
                          placeholder:
                            saved.storeSecrets && values[field.name]
                              ? "••••••••"
                              : "Enter to rescan",
                          hint: storeSecrets
                            ? "Will be saved in this browser only."
                            : "Required each rescan unless you agree to save it.",
                        }
                      : field
                  }
                  value={values[field.name] ?? ""}
                  onChange={(next) => setValue(field.name, next)}
                  idPrefix="edit-conn"
                />
              );
            })}

            {showDatabasePicker ? (
              <DatabasePicker
                values={values}
                availableDatabases={availableDatabases}
                loading={loadingDatabases}
                error={databaseError}
                onLoad={handleLoadDatabases}
                onChange={patchValues}
                canLoad={canLoadDatabases}
              />
            ) : null}
          </div>

          <RememberSecretsConsent
            id={`remember-secrets-edit-${saved.id}`}
            checked={storeSecrets}
            onCheckedChange={setStoreSecrets}
            className="sm:col-span-2"
          />
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
            disabled={!canSave || loadingDatabases}
            onClick={() => persist(false)}
          >
            Save
          </Button>
          <Button
            type="button"
            disabled={!canSaveAndRescan || loadingDatabases}
            onClick={() => persist(true)}
          >
            Save & rescan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
