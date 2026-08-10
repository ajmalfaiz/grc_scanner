import type {
  ServerAuthMethod,
  ServerConnectionValues,
  ServerScopeValues,
} from "@/lib/discovery/server/types";

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

export function parsePathList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateServerConnectionValues(
  values: Record<string, string>,
): ServerConnectionValues {
  const host = requireTrimmed(values, "host");
  const username = requireTrimmed(values, "username");
  const port = (values.port ?? "22").trim() || "22";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Invalid port");
  }

  const paths = parsePathList(values.paths);
  if (paths.length === 0) {
    throw new Error("paths is required — enter at least one path to scan");
  }

  const authRaw = (values.authMethod ?? "password").trim();
  const authMethod: ServerAuthMethod = authRaw === "privateKey" ? "privateKey" : "password";

  if (authMethod === "privateKey") {
    const privateKey = normalizePrivateKey(requireTrimmed(values, "privateKey"));
    if (!/BEGIN[\w\s]+PRIVATE KEY/.test(privateKey)) {
      throw new Error("Invalid private key — paste a PEM or OpenSSH private key");
    }
    return {
      host,
      port,
      username,
      authMethod,
      password: "",
      privateKey,
      passphrase: (values.passphrase ?? "").trim() || undefined,
      paths,
    };
  }

  const password = requireTrimmed(values, "password");
  return { host, port, username, authMethod, password, paths };
}

export function normalizeServerScopeValues(
  values: Record<string, string>,
): ServerScopeValues {
  const coverageMode = values.coverageMode === "full" ? "full" : "sample";
  const recursive = values.recursive === "no" ? "no" : "yes";
  const lineSampleRaw = values.lineSample ?? "head_tail";
  const lineSample = (["head", "tail", "head_tail", "random"].includes(lineSampleRaw)
    ? lineSampleRaw
    : "head_tail") as ServerScopeValues["lineSample"];

  return {
    coverageMode,
    extensions: values.extensions ?? "log, env, json, conf, yml",
    recursive,
    lineSample,
  };
}

export function parseExtensionAllowlist(raw: string | undefined): Set<string> | null {
  const list = (raw ?? "")
    .split(",")
    .map((part) => part.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? new Set(list) : null;
}
