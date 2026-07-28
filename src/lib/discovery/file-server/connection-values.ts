import type {
  FileServerAuthMethod,
  FileServerConnectionValues,
  FileServerProtocol,
  FileServerScopeValues,
} from "@/lib/discovery/file-server/types";

function requireTrimmed(values: Record<string, string>, key: string): string {
  const value = (values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function normalizePath(path: string | undefined): string {
  const raw = (path ?? "").trim();
  if (!raw || raw === ".") return "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function normalizePrivateKey(raw: string): string {
  // Browsers / paste often turn real newlines into literal \n.
  return raw.replace(/\\n/g, "\n").trim();
}

export function validateFileServerConnectionValues(
  values: Record<string, string>,
): FileServerConnectionValues {
  const protocolRaw = (values.protocol ?? "smb").trim().toLowerCase();
  if (protocolRaw !== "smb" && protocolRaw !== "sftp") {
    throw new Error("Invalid protocol — expected smb or sftp");
  }
  const protocol = protocolRaw as FileServerProtocol;
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const basePath = normalizePath(values.basePath);

  if (protocol === "smb") {
    const shareName = requireTrimmed(values, "shareName");
    const password = requireTrimmed(values, "password");
    return {
      protocol,
      host,
      username,
      password,
      authMethod: "password",
      shareName,
      domain: (values.domain ?? "").trim() || undefined,
      basePath,
    };
  }

  const port = (values.port ?? "22").trim() || "22";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }

  const authRaw = (values.authMethod ?? "password").trim();
  const authMethod: FileServerAuthMethod =
    authRaw === "privateKey" ? "privateKey" : "password";

  if (authMethod === "privateKey") {
    const privateKey = normalizePrivateKey(requireTrimmed(values, "privateKey"));
    if (!/BEGIN[\w\s]+PRIVATE KEY/.test(privateKey)) {
      throw new Error(
        "Invalid private key — paste a PEM or OpenSSH private key",
      );
    }
    const passphrase = (values.passphrase ?? "").trim() || undefined;
    return {
      protocol,
      host,
      username,
      password: "",
      authMethod,
      privateKey,
      passphrase,
      port,
      basePath,
    };
  }

  const password = requireTrimmed(values, "password");
  return {
    protocol,
    host,
    username,
    password,
    authMethod: "password",
    port,
    basePath,
  };
}

export function normalizeFileServerScopeValues(
  values: Record<string, string>,
): FileServerScopeValues {
  const coverageMode =
    values.coverageMode === "full" ? "full" : "sample";
  const fileTypesRaw = values.fileTypes ?? "all";
  const fileTypes =
    fileTypesRaw === "spreadsheets" || fileTypesRaw === "office_text"
      ? fileTypesRaw
      : "all";
  const prefer = values.prefer === "random" ? "random" : "recent";
  const maxFileSizeMb = values.maxFileSizeMb ?? "25";
  const maxFiles = values.maxFiles ?? "200";

  if (!/^\d+$/.test(maxFileSizeMb) || Number(maxFileSizeMb) <= 0) {
    throw new Error("Invalid maxFileSizeMb");
  }
  if (!/^\d+$/.test(maxFiles) || Number(maxFiles) <= 0) {
    throw new Error("Invalid maxFiles");
  }

  return {
    coverageMode,
    fileTypes,
    maxFileSizeMb,
    maxFiles,
    prefer,
  };
}

export function joinRemotePath(...parts: string[]): string {
  const joined = parts
    .flatMap((part) => part.split("/"))
    .filter((part) => part.length > 0)
    .join("/");
  return `/${joined}`;
}

export function basenameRemote(path: string): string {
  const cleaned = path.replace(/\/+$/, "");
  const idx = cleaned.lastIndexOf("/");
  return idx >= 0 ? cleaned.slice(idx + 1) : cleaned;
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}
