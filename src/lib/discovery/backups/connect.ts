import { openLocalFs } from "@/lib/discovery/file-server/local-fs";
import { openSftpFs } from "@/lib/discovery/file-server/sftp-fs";
import { openSmbFs } from "@/lib/discovery/file-server/smb-fs";
import type { RemoteFs, RemoteFsTestResult } from "@/lib/discovery/file-server/types";
import type { BackupsConnectionValues } from "@/lib/discovery/backups/types";

export async function openBackupsFs(connection: BackupsConnectionValues): Promise<RemoteFs> {
  if (connection.sourceType === "local") {
    return openLocalFs(connection.basePath);
  }
  if (connection.sourceType === "smb") {
    return openSmbFs({
      protocol: "smb",
      host: connection.host!,
      username: connection.username!,
      password: connection.password!,
      authMethod: "password",
      shareName: connection.shareName!,
      domain: connection.domain,
      basePath: connection.basePath,
    });
  }
  return openSftpFs({
    protocol: "sftp",
    host: connection.host!,
    username: connection.username!,
    password: connection.password ?? "",
    authMethod: connection.authMethod ?? "password",
    privateKey: connection.privateKey,
    passphrase: connection.passphrase,
    port: connection.port,
    basePath: connection.basePath,
  });
}

export async function withBackupsFs<T>(
  connection: BackupsConnectionValues,
  fn: (fs: RemoteFs) => Promise<T>,
): Promise<T> {
  const fs = await openBackupsFs(connection);
  try {
    return await fn(fs);
  } finally {
    await fs.close();
  }
}

export async function testBackupsConnection(
  connection: BackupsConnectionValues,
): Promise<RemoteFsTestResult> {
  return withBackupsFs(connection, (fs) => fs.test());
}
