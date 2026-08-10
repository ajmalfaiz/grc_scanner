import type { MongoClient } from "mongodb";

import { buildCollectionMatcher } from "@/lib/discovery/mongodb/connection-values";
import type {
  CollectionCatalog,
  MongoScopeValues,
} from "@/lib/discovery/mongodb/types";
import { MAX_COLLECTIONS } from "@/lib/discovery/mongodb/types";

export async function catalogCollections(
  client: MongoClient,
  database: string,
  scope: MongoScopeValues,
): Promise<CollectionCatalog[]> {
  const db = client.db(database);
  const matches = buildCollectionMatcher(scope.collectionPattern);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();

  const filtered = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .filter(matches)
    .slice(0, MAX_COLLECTIONS);

  const catalog: CollectionCatalog[] = [];
  for (const name of filtered) {
    const estimatedDocs = await db.collection(name).estimatedDocumentCount().catch(() => 0);
    catalog.push({ name, estimatedDocs });
  }
  return catalog;
}
