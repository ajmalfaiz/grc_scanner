import mysql from "mysql2/promise";

import {
  CONNECT_TIMEOUT_MS,
  type MysqlConnectionValues,
} from "@/lib/discovery/mysql/types";

function sslOption(sslMode: string): { rejectUnauthorized: boolean } | undefined {
  if (sslMode === "disabled") return undefined;
  if (sslMode === "required") return { rejectUnauthorized: true };
  // preferred — still negotiate TLS but do not hard-fail on self-signed certs.
  return { rejectUnauthorized: false };
}

export async function createMysqlConnection(values: MysqlConnectionValues) {
  const port = Number.parseInt(values.port, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("Port must be a number between 1 and 65535");
  }

  return mysql.createConnection({
    host: values.host,
    port,
    database: values.database || undefined,
    user: values.username,
    password: values.password,
    ssl: sslOption(values.sslMode),
    connectTimeout: CONNECT_TIMEOUT_MS,
    multipleStatements: false,
  });
}

export type MysqlConnection = mysql.Connection;

export async function withMysqlConnection<T>(
  values: MysqlConnectionValues,
  fn: (conn: MysqlConnection) => Promise<T>,
): Promise<T> {
  const conn = await createMysqlConnection(values);
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => {
      conn.destroy();
    });
  }
}

/** Open a connection and run a trivial query to verify credentials. */
export async function testMysqlConnection(
  values: MysqlConnectionValues,
): Promise<{ ok: true; serverVersion: string }> {
  return withMysqlConnection(values, async (conn) => {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT VERSION() AS version",
    );
    const serverVersion = String(rows[0]?.version ?? "unknown");
    return { ok: true as const, serverVersion };
  });
}
