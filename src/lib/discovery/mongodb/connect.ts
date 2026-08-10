import { MongoClient } from "mongodb";

import {
  CONNECT_TIMEOUT_MS,
  type MongoConnectionValues,
} from "@/lib/discovery/mongodb/types";

function buildConnectionUri(values: MongoConnectionValues): string {
  const auth = values.username
    ? `${encodeURIComponent(values.username)}:${encodeURIComponent(values.password)}@`
    : "";
  const params = new URLSearchParams({
    authSource: values.authSource || "admin",
    tls: values.tls === "false" ? "false" : "true",
  });
  return `mongodb://${auth}${values.host}:${values.port}/${encodeURIComponent(values.database)}?${params.toString()}`;
}

export async function createMongoClient(
  values: MongoConnectionValues,
): Promise<MongoClient> {
  const client = new MongoClient(buildConnectionUri(values), {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
  });
  await client.connect();
  return client;
}

export async function withMongoClient<T>(
  values: MongoConnectionValues,
  fn: (client: MongoClient) => Promise<T>,
): Promise<T> {
  const client = await createMongoClient(values);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function testMongoConnection(
  values: MongoConnectionValues,
): Promise<{ ok: true; serverVersion: string }> {
  return withMongoClient(values, async (client) => {
    const info = await client.db(values.database).admin().serverInfo().catch(
      // Non-admin users may not have buildInfo — fall back to a ping.
      async () => {
        await client.db(values.database).command({ ping: 1 });
        return { version: "unknown" };
      },
    );
    return { ok: true as const, serverVersion: String(info.version ?? "unknown") };
  });
}
