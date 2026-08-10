import { openSftpFs } from "@/lib/discovery/file-server/sftp-fs";
import type { RemoteFs, RemoteFsTestResult } from "@/lib/discovery/file-server/types";
import type { ServerConnectionValues } from "@/lib/discovery/server/types";

/** Server connector always speaks SSH/SFTP — reuses the file-server SFTP adapter. */
export async function openServerFs(connection: ServerConnectionValues): Promise<RemoteFs> {
  return openSftpFs({
    protocol: "sftp",
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    authMethod: connection.authMethod,
    privateKey: connection.privateKey,
    passphrase: connection.passphrase,
    basePath: connection.paths[0] ?? "/",
  });
}

export async function withServerFs<T>(
  connection: ServerConnectionValues,
  fn: (fs: RemoteFs) => Promise<T>,
): Promise<T> {
  const fs = await openServerFs(connection);
  try {
    return await fn(fs);
  } finally {
    await fs.close();
  }
}

export async function testServerConnection(
  connection: ServerConnectionValues,
): Promise<RemoteFsTestResult> {
  return withServerFs(connection, (fs) => fs.test());
}
