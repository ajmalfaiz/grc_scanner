import { describe, expect, it } from "vitest";

import {
  extensionOf,
  joinRemotePath,
  normalizeFileServerScopeValues,
  validateFileServerConnectionValues,
} from "@/lib/discovery/file-server/connection-values";

describe("file-server connection values", () => {
  it("validates SMB connection fields", () => {
    expect(
      validateFileServerConnectionValues({
        protocol: "smb",
        host: "files.local",
        shareName: "HR_Share",
        username: "svc",
        password: "secret",
        domain: "CORP",
        basePath: "shared/hr",
      }),
    ).toMatchObject({
      protocol: "smb",
      host: "files.local",
      shareName: "HR_Share",
      domain: "CORP",
      basePath: "/shared/hr",
    });
  });

  it("validates SFTP connection fields", () => {
    expect(
      validateFileServerConnectionValues({
        protocol: "sftp",
        host: "sftp.local",
        port: "2222",
        username: "svc",
        authMethod: "password",
        password: "secret",
      }),
    ).toMatchObject({
      protocol: "sftp",
      port: "2222",
      authMethod: "password",
      basePath: "/",
    });
  });

  it("validates SFTP private key auth", () => {
    const key = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmU=
-----END OPENSSH PRIVATE KEY-----`;
    expect(
      validateFileServerConnectionValues({
        protocol: "sftp",
        host: "sftp.local",
        port: "22",
        username: "opc",
        authMethod: "privateKey",
        privateKey: key,
        passphrase: "key-secret",
      }),
    ).toMatchObject({
      protocol: "sftp",
      authMethod: "privateKey",
      password: "",
      privateKey: key,
      passphrase: "key-secret",
    });
  });

  it("rejects SFTP without password or private key", () => {
    expect(() =>
      validateFileServerConnectionValues({
        protocol: "sftp",
        host: "sftp.local",
        username: "svc",
        authMethod: "password",
        password: "",
      }),
    ).toThrow(/password is required/);

    expect(() =>
      validateFileServerConnectionValues({
        protocol: "sftp",
        host: "sftp.local",
        username: "svc",
        authMethod: "privateKey",
        privateKey: "not-a-key",
      }),
    ).toThrow(/Invalid private key/);
  });

  it("rejects missing share for SMB and invalid ports for SFTP", () => {
    expect(() =>
      validateFileServerConnectionValues({
        protocol: "smb",
        host: "files.local",
        username: "svc",
        password: "secret",
      }),
    ).toThrow(/shareName is required/);

    expect(() =>
      validateFileServerConnectionValues({
        protocol: "sftp",
        host: "sftp.local",
        port: "abc",
        username: "svc",
        password: "secret",
      }),
    ).toThrow(/Invalid port/);
  });
});

describe("file-server scope values", () => {
  it("normalizes defaults", () => {
    expect(normalizeFileServerScopeValues({})).toEqual({
      coverageMode: "sample",
      fileTypes: "all",
      maxFileSizeMb: "25",
      maxFiles: "200",
      prefer: "recent",
    });
  });

  it("accepts full mode and spreadsheets", () => {
    expect(
      normalizeFileServerScopeValues({
        coverageMode: "full",
        fileTypes: "spreadsheets",
        prefer: "random",
        maxFileSizeMb: "5",
        maxFiles: "50",
      }),
    ).toMatchObject({
      coverageMode: "full",
      fileTypes: "spreadsheets",
      prefer: "random",
    });
  });
});

describe("path helpers", () => {
  it("joins and extracts extensions", () => {
    expect(joinRemotePath("/", "hr", "file.csv")).toBe("/hr/file.csv");
    expect(extensionOf("employee-master.xlsx")).toBe("xlsx");
    expect(extensionOf("README")).toBe("");
  });
});
