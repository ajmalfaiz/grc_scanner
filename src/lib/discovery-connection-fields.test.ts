import { describe, expect, it } from "vitest";
import {
  areRequiredFieldsFilled,
  buildInitialValues,
  connectionFieldsByConnector,
  getConnectionFields,
  getVisibleFields,
} from "@/lib/discovery-connection-fields";
import type { ConnectorId } from "@/lib/discovery-mock-data";

describe("discovery connection fields", () => {
  const connectors = Object.keys(
    connectionFieldsByConnector,
  ) as ConnectorId[];

  it("defines fields for every connector", () => {
    expect(connectors).toEqual([
      "postgres",
      "mysql",
      "mongodb",
      "file-server",
      "server",
      "saas",
    ]);
  });

  it("builds defaults and validates required postgres fields", () => {
    const fields = getConnectionFields("postgres");
    const values = buildInitialValues(fields);
    expect(values.connectionMode).toBe("fields");
    expect(values.port).toBe("5432");
    expect(values.databaseMode).toBe("selected");
    expect(areRequiredFieldsFilled(fields, values)).toBe(false);

    values.username = "reader";
    // Password and database picker are handled separately from required field defs.
    expect(areRequiredFieldsFilled(fields, values)).toBe(true);
    expect(fields.find((f) => f.name === "password")?.required).toBe(false);
    expect(fields.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        "host",
        "port",
        "username",
        "password",
        "sslMode",
        "databaseMode",
        "databases",
        "database",
      ]),
    );
    const names = fields.map((f) => f.name);
    expect(names.indexOf("username")).toBeLessThan(names.indexOf("databases"));
    expect(names.indexOf("password")).toBeLessThan(names.indexOf("databases"));
  });

  it("switches postgres between separate fields and a connection string", () => {
    const fields = getConnectionFields("postgres");
    const values = buildInitialValues(fields);
    expect(getVisibleFields(fields, values).map((f) => f.name)).toContain("host");
    expect(getVisibleFields(fields, values).map((f) => f.name)).not.toContain(
      "connectionString",
    );

    values.connectionMode = "connectionString";
    const visible = getVisibleFields(fields, values).map((f) => f.name);
    expect(visible).toContain("connectionString");
    expect(visible).not.toContain("host");
    expect(areRequiredFieldsFilled(fields, values)).toBe(false);

    values.connectionString = "postgresql://reader:secret@db.local:5432/app";
    expect(areRequiredFieldsFilled(fields, values)).toBe(true);
  });

  it("shows SMB share fields and hides SFTP port by default", () => {
    const fields = getConnectionFields("file-server");
    const values = buildInitialValues(fields);
    expect(values.protocol).toBe("smb");

    const visible = getVisibleFields(fields, values).map((f) => f.name);
    expect(visible).toContain("shareName");
    expect(visible).toContain("password");
    expect(visible).not.toContain("port");
    expect(visible).not.toContain("authMethod");
    expect(visible).not.toContain("privateKey");

    values.protocol = "sftp";
    const sftpVisible = getVisibleFields(fields, values).map((f) => f.name);
    expect(sftpVisible).toContain("port");
    expect(sftpVisible).toContain("authMethod");
    expect(sftpVisible).toContain("password");
    expect(sftpVisible).not.toContain("shareName");
    expect(sftpVisible).not.toContain("privateKey");

    values.authMethod = "privateKey";
    const keyVisible = getVisibleFields(fields, values).map((f) => f.name);
    expect(keyVisible).toContain("privateKey");
    expect(keyVisible).toContain("passphrase");
    expect(keyVisible).not.toContain("password");
  });

  it("switches SaaS fields between HubSpot and Zoho", () => {
    const fields = getConnectionFields("saas");
    const hubspot = buildInitialValues(fields);
    expect(hubspot.vendor).toBe("hubspot");
    expect(
      getVisibleFields(fields, hubspot).map((f) => f.name),
    ).toContain("accessToken");

    hubspot.vendor = "zoho";
    const zohoNames = getVisibleFields(fields, hubspot).map((f) => f.name);
    expect(zohoNames).toContain("clientId");
    expect(zohoNames).toContain("refreshToken");
    expect(zohoNames).not.toContain("accessToken");
  });

  it("requires SSH private key when auth method is privateKey", () => {
    const fields = getConnectionFields("server");
    const values = buildInitialValues(fields);
    values.host = "app-01";
    values.username = "svc";
    values.authMethod = "privateKey";
    values.password = "unused";
    expect(areRequiredFieldsFilled(fields, values)).toBe(false);
    values.privateKey = "KEY";
    expect(areRequiredFieldsFilled(fields, values)).toBe(true);
  });
});
