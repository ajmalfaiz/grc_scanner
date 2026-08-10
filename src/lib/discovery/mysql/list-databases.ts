import type { MysqlConnection } from "@/lib/discovery/mysql/connect";
import { withMysqlConnection } from "@/lib/discovery/mysql/connect";
import { resolveMysqlDatabaseSelection } from "@/lib/discovery/mysql/databases";
import type { MysqlConnectionValues } from "@/lib/discovery/mysql/types";
import { SYSTEM_SCHEMAS } from "@/lib/discovery/mysql/types";

/** List databases visible over an already-open connection. */
export async function listMysqlDatabasesWithConnection(
  conn: MysqlConnection,
): Promise<string[]> {
  const [rows] = await conn.query("SHOW DATABASES");
  return (rows as Array<{ Database: string }>)
    .map((row) => row.Database)
    .filter((name) => !SYSTEM_SCHEMAS.has(name));
}

/**
 * List databases the connected user can see. Unlike Postgres, MySQL can
 * list and query across every accessible database over a single
 * connection, so no per-database reconnect is needed.
 */
export async function listMysqlDatabases(
  connection: MysqlConnectionValues,
): Promise<string[]> {
  return withMysqlConnection(connection, listMysqlDatabasesWithConnection);
}

/**
 * Databases to catalog for this connection. "all" resolves from the server
 * at scan time (reusing the already-open connection); "selected" uses the
 * explicit list from connection values.
 */
export async function resolveScanDatabasesWithConnection(
  conn: MysqlConnection,
  connection: MysqlConnectionValues,
): Promise<string[]> {
  const selection = resolveMysqlDatabaseSelection(connection);
  if (selection.mode === "all") {
    return listMysqlDatabasesWithConnection(conn);
  }
  if (selection.databases.length === 0) {
    throw new Error("Select at least one database to scan");
  }
  return selection.databases;
}
