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
      fullWidth: true,
    },
    {
      name: "databases",
      label: "Selected databases",
      type: "text",
      required: false,
      placeholder: "app_production, analytics",
      hint: "Chosen from the server list, or comma-separated names.",
      fullWidth: true,
    },
    {
      name: "database",
      label: "Primary database",
      type: "text",
      required: false,
      placeholder: "app_production",
      hint: "Used for labels and as a fallback when listing databases.",
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
      name: "baseUrl",
      label: "Base URL",
      type: "text",
      required: true,
      placeholder: "https://api.example.com",
      hint: "Works with any REST/JSON API app — add more apps over time by changing this connection, no code needed per vendor.",
      fullWidth: true,
    },
    {
      name: "authType",
      label: "Authentication",
      type: "select",
      required: true,
      defaultValue: "bearer",
      options: [
        { value: "bearer", label: "Bearer token" },
        { value: "api_key", label: "API key header" },
        { value: "basic", label: "Basic auth" },
        { value: "oauth2_client_credentials", label: "OAuth2 (client credentials)" },
        { value: "none", label: "None (public API)" },
      ],
      fullWidth: true,
    },
    {
      name: "tokenUrl",
      label: "Token URL",
      type: "text",
      required: true,
      placeholder: "https://api.example.com/oauth/token",
      when: { field: "authType", equals: "oauth2_client_credentials" },
      fullWidth: true,
      hint: "A fresh token is fetched per scan run and reused across resources (cached until it expires)",
    },
    {
      name: "clientId",
      label: "Client ID",
      type: "text",
      required: true,
      when: { field: "authType", equals: "oauth2_client_credentials" },
    },
    {
      name: "clientSecret",
      label: "Client secret",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "authType", equals: "oauth2_client_credentials" },
    },
    {
      name: "oauthScope",
      label: "Scope",
      type: "text",
      required: false,
      placeholder: "read:contacts read:companies",
      when: { field: "authType", equals: "oauth2_client_credentials" },
      fullWidth: true,
      hint: "Optional — space-separated scopes, only if the provider requires them",
    },
    {
      name: "bearerToken",
      label: "Bearer token",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "authType", equals: "bearer" },
      fullWidth: true,
    },
    {
      name: "apiKeyHeader",
      label: "API key header name",
      type: "text",
      required: false,
      defaultValue: "X-API-Key",
      when: { field: "authType", equals: "api_key" },
    },
    {
      name: "apiKeyValue",
      label: "API key value",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "authType", equals: "api_key" },
    },
    {
      name: "basicUsername",
      label: "Username",
      type: "text",
      required: true,
      when: { field: "authType", equals: "basic" },
    },
    {
      name: "basicPassword",
      label: "Password",
      type: "password",
      required: false,
      when: { field: "authType", equals: "basic" },
    },
    {
      name: "extraHeaders",
      label: "Extra headers",
      type: "textarea",
      required: false,
      placeholder: "X-Api-Version: 3\nX-Tenant: acme",
      hint: "Optional — one `Header-Name: value` per line",
      fullWidth: true,
    },
    {
      name: "resources",
      label: "Resources to scan",
      type: "textarea",
      required: true,
      placeholder: "contacts:/api/v3/contacts\ncompanies:/api/v3/companies",
      hint: "One per line: name:/path — each must return a JSON array (or a wrapper like { data: [...] })",
      fullWidth: true,
    },
  ],

  email: [
    {
      name: "host",
      label: "IMAP host",
      type: "text",
      required: true,
      placeholder: "imap.company.internal",
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "993",
      defaultValue: "993",
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "svc_discovery@company.com",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
      hint: "Many providers (Gmail, Outlook) require an app-specific password rather than the account password",
      fullWidth: true,
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
    },
    {
      name: "mailboxes",
      label: "Mailboxes",
      type: "text",
      required: false,
      placeholder: "INBOX, Sent, Archive",
      defaultValue: "INBOX",
      hint: "Comma-separated. Blank = INBOX only",
      fullWidth: true,
    },
  ],

  backups: [
    {
      name: "sourceType",
      label: "Source",
      type: "select",
      required: true,
      defaultValue: "local",
      options: [
        { value: "local", label: "Local / mounted path" },
        { value: "sftp", label: "SFTP" },
        { value: "smb", label: "SMB" },
      ],
      fullWidth: true,
    },
    {
      name: "basePath",
      label: "Base path",
      type: "text",
      required: true,
      placeholder: "/mnt/backups",
      fullWidth: true,
      hint: "Folder containing backup archives (.zip, .tar, .tar.gz)",
    },
    // sourceType has 3 branches but `when` only supports one field/value pair,
    // so host/username/password are shown whenever sourceType isn't "local" —
    // approximated here by showing for sftp, with SMB-only fields separate.
    {
      name: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "backups.company.internal",
      when: { field: "sourceType", equals: "sftp" },
    },
    {
      name: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "22",
      defaultValue: "22",
      when: { field: "sourceType", equals: "sftp" },
    },
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "svc_discovery",
      when: { field: "sourceType", equals: "sftp" },
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
      when: { field: "sourceType", equals: "sftp" },
      fullWidth: true,
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: false,
      placeholder: "••••••••",
      when: { field: "sourceType", equals: "sftp" },
      fullWidth: true,
    },
    {
      name: "privateKey",
      label: "Private key",
      type: "textarea",
      required: false,
      placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----",
      when: { field: "authMethod", equals: "privateKey" },
      fullWidth: true,
    },
    {
      name: "passphrase",
      label: "Key passphrase",
      type: "password",
      required: false,
      when: { field: "authMethod", equals: "privateKey" },
      fullWidth: true,
    },
    {
      name: "smbHost",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "files.company.internal",
      when: { field: "sourceType", equals: "smb" },
    },
    {
      name: "shareName",
      label: "Share name",
      type: "text",
      required: true,
      placeholder: "Backups",
      when: { field: "sourceType", equals: "smb" },
    },
    {
      name: "domain",
      label: "Domain",
      type: "text",
      required: false,
      placeholder: "CORP",
      when: { field: "sourceType", equals: "smb" },
    },
    {
      name: "smbUsername",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "svc_discovery",
      when: { field: "sourceType", equals: "smb" },
    },
    {
      name: "smbPassword",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••",
      when: { field: "sourceType", equals: "smb" },
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
