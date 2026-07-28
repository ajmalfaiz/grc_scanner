import { openSmbFs } from "@/lib/discovery/file-server/smb-fs";
import { openSftpFs } from "@/lib/discovery/file-server/sftp-fs";
import type {
  FileServerConnectionValues,
  RemoteFs,
  RemoteFsTestResult,
} from "@/lib/discovery/file-server/types";

export async function openRemoteFs(
  connection: FileServerConnectionValues,
): Promise<RemoteFs> {
  if (connection.protocol === "smb") {
    return openSmbFs(connection);
  }
  return openSftpFs(connection);
}

export async function withRemoteFs<T>(
  connection: FileServerConnectionValues,
  fn: (fs: RemoteFs) => Promise<T>,
): Promise<T> {
  const fs = await openRemoteFs(connection);
  try {
    return await fn(fs);
  } finally {
    await fs.close();
  }
}

export async function testFileServerConnection(
  connection: FileServerConnectionValues,
): Promise<RemoteFsTestResult> {
  return withRemoteFs(connection, (fs) => fs.test());
}
