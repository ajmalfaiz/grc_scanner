import type { ConnectorId } from "@/lib/discovery-mock-data";

export type ConnectionFieldType =
  | "text"
  | "password"
  | "number"
  | "select"
  | "textarea";

export type ConnectionField = {
  name: string;
  label: string;
  type: ConnectionFieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Only show when another field has this value */
  when?: { field: string; equals: string };
  /** Span both columns in the form grid */
  fullWidth?: boolean;
};

/**
 * What each connector needs in order to establish a connection.
 * Postgres posts these to `/api/discovery/postgres/scan` for a live run.
 * Other connectors still use client-side mock results.
 */
export const connectionFieldsByConnector: Record<
  ConnectorId,
  ConnectionField[]
> = {
  postgres: [
    {
      name: "connectionMode",
      label: "Connection input",
      type: "select",
      required: true,
      defaultValue: "fields",
      options: [
        { value: "fields", label: "Separate fields" },
        { value: "connectionString", label: "Connection string" },
      ],
      fullWidth: true,
    },
    {
      name: "connectionString",
      label: "Connection string",
      type: "password",
      required: true,
      placeholder:
        "postgresql://reader:password@db.company.internal:5432/app?sslmode=require",
      hint: "Use this when you already have a Postgres URL. It is parsed before saving.",
      when: { field: "connectionMode", equals: "connectionString" },
      fullWidth: true,
    },
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "db.company.internal",
      defaultValue: "localhost",
      when: { field: "connectionMode", equals: "fields" },
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "5432",
      defaultValue: "5432",
      when: { field: "connectionMode", equals: "fields" },
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "readonly_scanner",
      when: { field: "connectionMode", equals: "fields" },
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: false,
      placeholder: "••••••••",
      hint: "Optional — leave blank for trust/peer auth (common on local Postgres)",
      when: { field: "connectionMode", equals: "fields" },
      fullWidth: true,
    },
    {
      name: "sslMode",
      label: "SSL mode",
      type: "select",
      required: true,
      defaultValue: "prefer",
      options: [
        { value: "disable", label: "Disable" },
        { value: "prefer", label: "Prefer" },
        { value: "require", label: "Require" },
      ],
      when: { field: "connectionMode", equals: "fields" },
      fullWidth: true,
    },
    {
      name: "databaseMode",
      label: "Databases to analyse",
      type: "select",
      required: true,
      defaultValue: "selected",
      options: [
        { value: "all", label: "All databases" },
        { value: "selected", label: "Selected databases" },
      ],
      hint: "Load available databases after entering host and credentials.",
      when: { field: "connectionMode", equals: "fields" },
      fullWidth: true,
    },
    {
      name: "databases",
      label: "Selected databases",
      type: "text",
      required: false,
      placeholder: "hr, analytics",
      hint: "Chosen from the server list, or comma-separated names.",
      when: { field: "connectionMode", equals: "fields" },
      fullWidth: true,
    },
    {
      name: "database",
      label: "Primary database",
      type: "text",
      required: false,
      placeholder: "postgres",
      hint: "Used for labels and as a fallback when listing databases.",
      when: { field: "connectionMode", equals: "fields" },
    },
  ],

  mysql: [
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "mysql.company.internal",
      defaultValue: "localhost",
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "3306",
      defaultValue: "3306",
    },
    {
      name: "database",
      label: "Database",
      type: "text",
      required: true,
      placeholder: "app_production",
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "readonly_scanner",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
      fullWidth: true,
    },
    {
      name: "sslMode",
      label: "SSL mode",
      type: "select",
      required: true,
      defaultValue: "preferred",
      options: [
        { value: "disabled", label: "Disabled" },
        { value: "preferred", label: "Preferred" },
        { value: "required", label: "Required" },
      ],
      fullWidth: true,
    },
  ],

  mongodb: [
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "mongo.company.internal",
      defaultValue: "localhost",
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "27017",
      defaultValue: "27017",
    },
    {
      name: "database",
      label: "Database",
      type: "text",
      required: true,
      placeholder: "customers",
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "readonly_scanner",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
    },
    {
      name: "authSource",
      label: "Auth source",
      type: "text",
      required: false,
      placeholder: "admin",
      defaultValue: "admin",
      hint: "Usually admin for Atlas or self-hosted auth DB",
    },
    {
      name: "tls",
      label: "TLS",
      type: "select",
      required: true,
      defaultValue: "true",
      options: [
        { value: "true", label: "Enabled" },
        { value: "false", label: "Disabled" },
      ],
      fullWidth: true,
    },
  ],

  "file-server": [
    {
      name: "protocol",
      label: "Protocol",
      type: "select",
      required: true,
      defaultValue: "smb",
      options: [
        { value: "smb", label: "SMB" },
        { value: "sftp", label: "SFTP" },
      ],
      fullWidth: true,
    },
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "files.company.internal",
    },
    {
      name: "shareName",
      label: "Share name",
      type: "text",
      required: true,
      placeholder: "HR_Share",
      when: { field: "protocol", equals: "smb" },
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "22",
      defaultValue: "22",
      when: { field: "protocol", equals: "sftp" },
    },
    {
      name: "domain",
      label: "Domain",
      type: "text",
      required: false,
      placeholder: "CORP",
      when: { field: "protocol", equals: "smb" },
      hint: "Windows / AD domain if required",
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "svc_discovery",
    },
    {
      name: "authMethod",
      label: "Auth method",
      type: "select",
      required: true,
      defaultValue: "password",
      options: [
        { value: "password", label: "Password" },
        { value: "privateKey", label: "SSH private key" },
      ],
      when: { field: "protocol", equals: "sftp" },
      fullWidth: true,
      hint: "Use a private key for OCI / cloud VMs that disable password SSH",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "authMethod", equals: "password" },
      fullWidth: true,
    },
    {
      name: "privateKey",
      label: "Private key",
      type: "textarea",
      required: true,
      placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
      when: { field: "authMethod", equals: "privateKey" },
      fullWidth: true,
      hint: "Paste the full PEM / OpenSSH private key contents",
    },
    {
      name: "passphrase",
      label: "Key passphrase",
      type: "password",
      required: false,
      placeholder: "••••••••",
      when: { field: "authMethod", equals: "privateKey" },
      fullWidth: true,
      hint: "Only if the private key is encrypted",
    },
    {
      name: "basePath",
      label: "Base path",
      type: "text",
      required: false,
      placeholder: "/shared/hr",
      fullWidth: true,
      hint: "Optional folder to restrict the scan",
    },
  ],

  server: [
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "app-01.company.internal",
    },
    {
      name: "port",
      label: "SSH port",
      type: "number",
      required: true,
      placeholder: "22",
      defaultValue: "22",
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "svc_discovery",
    },
    {
      name: "authMethod",
      label: "Auth method",
      type: "select",
      required: true,
      defaultValue: "password",
      options: [
        { value: "password", label: "Password" },
        { value: "privateKey", label: "SSH private key" },
      ],
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "authMethod", equals: "password" },
      fullWidth: true,
    },
    {
      name: "privateKey",
      label: "Private key",
      type: "textarea",
      required: true,
      placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
      when: { field: "authMethod", equals: "privateKey" },
      fullWidth: true,
    },
    {
      name: "paths",
      label: "Paths to scan",
      type: "textarea",
      required: true,
      placeholder: "/var/log\n/etc/app\n/opt/batch/exports",
      defaultValue: "/var/log\n/etc/app",
      fullWidth: true,
      hint: "One path per line — logs and config directories",
    },
  ],

  saas: [
    {
      name: "vendor",
      label: "Vendor",
      type: "select",
      required: true,
      defaultValue: "hubspot",
      options: [
        { value: "hubspot", label: "HubSpot" },
        { value: "zoho", label: "Zoho" },
      ],
      fullWidth: true,
    },
    {
      name: "accessToken",
      label: "Private app access token",
      type: "password",
      required: true,
      placeholder: "pat-na1-…",
      when: { field: "vendor", equals: "hubspot" },
      fullWidth: true,
    },
    {
      name: "portalId",
      label: "Portal ID",
      type: "text",
      required: false,
      placeholder: "12345678",
      when: { field: "vendor", equals: "hubspot" },
      hint: "Optional — helps label findings by account",
    },
    {
      name: "clientId",
      label: "Client ID",
      type: "text",
      required: true,
      placeholder: "1000.XXXX",
      when: { field: "vendor", equals: "zoho" },
    },
    {
      name: "clientSecret",
      label: "Client secret",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "vendor", equals: "zoho" },
    },
    {
      name: "refreshToken",
      label: "Refresh token",
      type: "password",
      required: true,
      placeholder: "1000.XXXX.YYYY",
      when: { field: "vendor", equals: "zoho" },
      fullWidth: true,
    },
    {
      name: "region",
      label: "Data center",
      type: "select",
      required: true,
      defaultValue: "com",
      when: { field: "vendor", equals: "zoho" },
      options: [
        { value: "com", label: "US (.com)" },
        { value: "eu", label: "EU (.eu)" },
        { value: "in", label: "India (.in)" },
        { value: "com.au", label: "Australia (.com.au)" },
        { value: "jp", label: "Japan (.jp)" },
      ],
      fullWidth: true,
    },
  ],
};

export function getConnectionFields(
  connectorId: ConnectorId,
): ConnectionField[] {
  return connectionFieldsByConnector[connectorId];
}

export function getVisibleFields(
  fields: ConnectionField[],
  values: Record<string, string>,
): ConnectionField[] {
  return fields.filter((field) => {
    if (!field.when) return true;
    return values[field.when.field] === field.when.equals;
  });
}

export function buildInitialValues(fields: ConnectionField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.name] = field.defaultValue ?? "";
  }
  return values;
}

export function areRequiredFieldsFilled(
  fields: ConnectionField[],
  values: Record<string, string>,
): boolean {
  return getVisibleFields(fields, values).every((field) => {
    if (!field.required) return true;
    return (values[field.name] ?? "").trim().length > 0;
  });
}
