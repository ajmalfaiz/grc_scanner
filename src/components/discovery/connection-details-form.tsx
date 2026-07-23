"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, PlugZap } from "lucide-react";

import { DiscoveryFieldControl } from "@/components/discovery/discovery-field-control";
import {
  isPostgresDatabaseSelectionReady,
  PostgresDatabasePicker,
} from "@/components/discovery/postgres-database-picker";
import { RememberSecretsConsent } from "@/components/discovery/remember-secrets-consent";
import { Button } from "@/components/ui/button";
import {
  buildInitialValues,
  getConnectionFields,
  getVisibleFields,
} from "@/lib/discovery-connection-fields";
import {
  listDiscoveryDatabases,
  testDiscoveryConnection,
} from "@/lib/discovery-scan-client";
import {
  getScanResult,
  type ConnectorId,
} from "@/lib/discovery-mock-data";
import { normalizePostgresConnectionValues } from "@/lib/discovery/postgres/connection-values";
import { parseDatabaseList } from "@/lib/discovery/postgres/databases";
import {
  getSavedConnection,
  saveDiscoveryDraft,
} from "@/lib/saved-connections";

const POSTGRES_PICKER_FIELDS = new Set([
  "databaseMode",
  "databases",
  "database",
]);

function initialConnectionState(
  connectorId: ConnectorId,
  savedId?: string,
) {
  const fields = getConnectionFields(connectorId);
  const base = buildInitialValues(fields);
  if (!savedId) {
    return { values: base, activeSavedId: undefined as string | undefined };
  }
  const saved = getSavedConnection(savedId);
  if (!saved || saved.connectorId !== connectorId) {
    return { values: base, activeSavedId: undefined };
  }
  return {
    values: { ...base, ...saved.connectionValues },
    activeSavedId: saved.id,
  };
}

function authFieldsReady(
  connectorId: ConnectorId,
  values: Record<string, string>,
): boolean {
  if (connectorId !== "postgres") return true;
  if (values.connectionMode === "connectionString") {
    return (values.connectionString ?? "").trim().length > 0;
  }
  return (
    (values.host ?? "").trim().length > 0 &&
    (values.port ?? "").trim().length > 0 &&
    (values.username ?? "").trim().length > 0
  );
}

export function ConnectionDetailsForm({
  connectorId,
  savedId,
}: {
  connectorId: ConnectorId;
  savedId?: string;
}) {
  const router = useRouter();
  const result = getScanResult(connectorId);
  const fields = useMemo(
    () => getConnectionFields(connectorId),
    [connectorId],
  );
  const initial = useMemo(
    () => initialConnectionState(connectorId, savedId),
    [connectorId, savedId],
  );
  const [values, setValues] = useState(initial.values);
  const [activeSavedId] = useState(initial.activeSavedId);
  const [storeSecrets, setStoreSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>(() =>
    parseDatabaseList(initial.values.databases),
  );
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  if (!result) return null;

  const Icon = result.icon;
  const visible = getVisibleFields(fields, values).filter(
    (field) =>
      connectorId !== "postgres" || !POSTGRES_PICKER_FIELDS.has(field.name),
  );
  const supportsLiveTest = connectorId === "postgres";
  const authReady = authFieldsReady(connectorId, values);
  const databaseReady =
    connectorId !== "postgres" ||
    values.connectionMode === "connectionString" ||
    isPostgresDatabaseSelectionReady(values);
  const canSubmit =
    visible.every((field) => {
      if (!field.required) return true;
      return (values[field.name] ?? "").trim().length > 0;
    }) && databaseReady;
  const canTest = supportsLiveTest && canSubmit && !testing && !loadingDatabases;
  const canLoadDatabases =
    supportsLiveTest &&
    authReady &&
    values.connectionMode !== "connectionString" &&
    !loadingDatabases &&
    !testing;

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setTestMessage(null);
    setTestError(null);
    if (
      name === "host" ||
      name === "port" ||
      name === "username" ||
      name === "password" ||
      name === "sslMode"
    ) {
      setDatabaseError(null);
    }
  }

  function patchValues(patch: Record<string, string>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setTestMessage(null);
    setTestError(null);
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
          database: result.databases[0] ?? values.database ?? "postgres",
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

  async function handleTestConnection() {
    if (!canTest) return;
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const result = await testDiscoveryConnection({
        connectorId,
        connectionValues: values,
      });
      setTestMessage(result.message);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || testing || loadingDatabases) return;

    let connectionValues = values;
    try {
      connectionValues =
        connectorId === "postgres"
          ? normalizePostgresConnectionValues(values)
          : values;
    } catch (err) {
      setTestMessage(null);
      setTestError(
        err instanceof Error ? err.message : "Invalid connection details",
      );
      return;
    }

    saveDiscoveryDraft({
      connectorId,
      savedId: activeSavedId,
      storeSecrets,
      connectionValues,
    });

    const scopeQuery = activeSavedId ? `?saved=${activeSavedId}` : "";
    router.push(`/discovery/scope/${connectorId}${scopeQuery}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <header className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Step 2 of 4</p>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Icon className="size-4 text-foreground" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                Connect {result.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {activeSavedId
                  ? "Update connection details. Re-enter secrets unless you previously chose to save them."
                  : "Enter host and credentials, then choose which databases to analyse."}
              </p>
            </div>
          </div>
        </header>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link href="/discovery" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 content-start gap-x-3 gap-y-2.5 sm:grid-cols-2">
          {visible.map((field) => (
            <DiscoveryFieldControl
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              onChange={(next) => setValue(field.name, next)}
              idPrefix="conn"
            />
          ))}

          {supportsLiveTest && values.connectionMode !== "connectionString" ? (
            <PostgresDatabasePicker
              values={values}
              availableDatabases={availableDatabases}
              loading={loadingDatabases}
              error={databaseError}
              onLoad={handleLoadDatabases}
              onChange={patchValues}
              canLoad={canLoadDatabases}
            />
          ) : null}

          <RememberSecretsConsent
            id="remember-secrets-connect"
            checked={storeSecrets}
            onCheckedChange={setStoreSecrets}
            className="sm:col-span-2"
          />
        </div>
      </div>

      {testMessage ? (
        <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {testMessage}
        </div>
      ) : null}

      {testError ? (
        <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {testError}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border pt-3">
        {supportsLiveTest ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!canTest}
            onClick={handleTestConnection}
          >
            {testing ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <PlugZap data-icon="inline-start" />
            )}
            {testing ? "Testing…" : "Test connection"}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit || testing || loadingDatabases}
          className="min-w-44"
        >
          Continue
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
