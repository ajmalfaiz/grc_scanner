import type {
  BackupsConnectionValues,
  BackupsScopeValues,
  BackupsSourceType,
} from "@/lib/discovery/backups/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export function validateBackupsConnectionValues(
  values: Record<string, string>,
): BackupsConnectionValues {
  const sourceTypeRaw = (values.sourceType ?? "local").trim();
  const sourceType: BackupsSourceType = (["local", "sftp", "smb"].includes(sourceTypeRaw)
    ? sourceTypeRaw
    : "local") as BackupsSourceType;
  const basePath = requireTrimmed(values, "basePath");

  if (sourceType === "local") {
    return { sourceType, basePath };
  }

  if (sourceType === "smb") {
    return {
      sourceType,
      basePath,
      host: requireTrimmed(values, "smbHost"),
      username: requireTrimmed(values, "smbUsername"),
      password: requireTrimmed(values, "smbPassword"),
      shareName: requireTrimmed(values, "shareName"),
      domain: (values.domain ?? "").trim() || undefined,
    };
  }

  // sftp
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const port = (values.port ?? "22").trim() || "22";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }
  const authRaw = (values.authMethod ?? "password").trim();
  const authMethod = authRaw === "privateKey" ? "privateKey" : "password";

  if (authMethod === "privateKey") {
    const privateKey = normalizePrivateKey(requireTrimmed(values, "privateKey"));
    if (!/BEGIN[\w\s]+PRIVATE KEY/.test(privateKey)) {
      throw new Error("Invalid private key — paste a PEM or OpenSSH private key");
    }
    return {
      sourceType,
      basePath,
      host,
      username,
      port,
      authMethod,
      privateKey,
      passphrase: (values.passphrase ?? "").trim() || undefined,
    };
  }

  return {
    sourceType,
    basePath,
    host,
    username,
    port,
    authMethod,
    password: requireTrimmed(values, "password"),
  };
}

export function normalizeBackupsScopeValues(
  values: Record<string, string>,
): BackupsScopeValues {
  return {
    coverageMode: values.coverageMode === "full" ? "full" : "sample",
    maxArchiveSizeMb: values.maxArchiveSizeMb ?? "100",
    maxArchives: values.maxArchives ?? "50",
    maxEntriesPerArchive: values.maxEntriesPerArchive ?? "200",
  };
}
