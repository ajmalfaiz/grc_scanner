import postgres from "postgres";

import {
  CONNECT_TIMEOUT_SECONDS,
  STATEMENT_TIMEOUT_MS,
  type PostgresConnectionValues,
} from "@/lib/discovery/postgres/types";

function sslOption(sslMode: string): boolean | "require" | "prefer" {
  switch (sslMode) {
    case "disable":
      return false;
    case "require":
      return "require";
    case "prefer":
    default:
      return "prefer";
  }
}

export function createPostgresClient(values: PostgresConnectionValues) {
  const port = Number.parseInt(values.port, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("Port must be a number between 1 and 65535");
  }

  return postgres({
    host: values.host,
    port,
    database: values.database,
    username: values.username,
    password: values.password,
    ssl: sslOption(values.sslMode),
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    idle_timeout: 5,
    max_lifetime: 60,
    connection: {
      statement_timeout: String(STATEMENT_TIMEOUT_MS),
    },
    onnotice: () => {},
  });
}

export type SqlClient = ReturnType<typeof createPostgresClient>;

export async function withPostgresClient<T>(
  values: PostgresConnectionValues,
  fn: (sql: SqlClient) => Promise<T>,
): Promise<T> {
  const sql = createPostgresClient(values);
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 });
  }
}

/** Open a connection and run a trivial query to verify credentials. */
export async function testPostgresConnection(
  values: PostgresConnectionValues,
): Promise<{ ok: true; serverVersion: string }> {
  return withPostgresClient(values, async (sql) => {
    const rows = await sql`SELECT current_setting('server_version') AS version`;
    const serverVersion = String(rows[0]?.version ?? "unknown");
    return { ok: true as const, serverVersion };
  });
}
