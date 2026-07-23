"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

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
} from "@/lib/discovery-connection-fields";
import type { ConnectorId } from "@/lib/discovery-mock-data";
import {
  areSecretsFilled,
  getVisibleSecretFields,
  updateSavedConnection,
  type SavedConnection,
} from "@/lib/saved-connections";

export function RescanCredentialsSheet({
  open,
  onOpenChange,
  saved,
  onRescanned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: SavedConnection;
  onRescanned: (
    next: SavedConnection,
    connectionValues: Record<string, string>,
  ) => void;
}) {
  const connectorId = saved.connectorId as ConnectorId;
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [storeSecrets, setStoreSecrets] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setSecretValues({});
    setStoreSecrets(false);
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const fields = useMemo(() => getConnectionFields(connectorId), [connectorId]);
  const baseValues = useMemo(
    () => ({
      ...buildInitialValues(fields),
      ...saved.connectionValues,
      ...secretValues,
    }),
    [fields, saved.connectionValues, secretValues],
  );
  const secretFields = getVisibleSecretFields(connectorId, baseValues);
  const canSubmit = areSecretsFilled(connectorId, baseValues) && !submitting;

  function setSecret(name: string, value: string) {
    setSecretValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleRescan() {
    if (!canSubmit) return;

    setSubmitting(true);
    const connectionValues = {
      ...saved.connectionValues,
      ...secretValues,
    };

    const next = updateSavedConnection({
      id: saved.id,
      connectionValues,
      storeSecrets,
      touchScan: false,
    });
    if (!next) {
      setSubmitting(false);
      return;
    }

    onRescanned(next, connectionValues);
    onOpenChange(false);
    setSubmitting(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Enter credentials to rescan</SheetTitle>
          <SheetDescription>
            {saved.label} does not keep a saved password or key. Enter them to
            run this scan. They are discarded afterward unless you agree below.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-y-2.5">
            {secretFields.map((field) => (
              <DiscoveryFieldControl
                key={field.name}
                field={{
                  ...field,
                  placeholder:
                    field.placeholder ??
                    (field.required ? "Required to rescan" : "Optional"),
                  hint:
                    field.hint ??
                    (field.required
                      ? "Not stored unless you agree below."
                      : "Leave blank if not required. Not stored unless you agree below."),
                  fullWidth: true,
                }}
                value={secretValues[field.name] ?? ""}
                onChange={(next) => setSecret(field.name, next)}
                idPrefix="rescan-secret"
              />
            ))}
          </div>

          <RememberSecretsConsent
            id={`remember-secrets-rescan-${saved.id}`}
            checked={storeSecrets}
            onCheckedChange={setStoreSecrets}
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
          <Button type="button" disabled={!canSubmit} onClick={handleRescan}>
            {submitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Rescan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
