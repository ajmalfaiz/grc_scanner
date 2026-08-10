/**
 * Flatten a document (or JSON-like object) into field-path → leaf values,
 * bounded by maxDepth. Arrays of primitives are kept under their parent
 * path; arrays of objects are sampled (first few elements) under `path[]`
 * so path counts stay bounded on deeply nested / large-array documents.
 */
export function flattenDocument(
  doc: Record<string, unknown>,
  maxDepth: number,
): Map<string, unknown[]> {
  const out = new Map<string, unknown[]>();

  function push(path: string, value: unknown) {
    const existing = out.get(path);
    if (existing) existing.push(value);
    else out.set(path, [value]);
  }

  function walk(value: unknown, path: string, depth: number) {
    if (value == null) return;

    if (Array.isArray(value)) {
      if (depth >= maxDepth) {
        push(path, value);
        return;
      }
      const objectItems = value.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      );
      if (objectItems.length > 0) {
        // Sample a few array elements rather than exploding every index.
        for (const item of objectItems.slice(0, 5)) {
          walk(item, `${path}[]`, depth + 1);
        }
      }
      const primitives = value.filter(
        (item) => !(item && typeof item === "object"),
      );
      if (primitives.length > 0) push(path, primitives);
      return;
    }

    if (value instanceof Date) {
      push(path, value.toISOString());
      return;
    }

    if (typeof value === "object") {
      if (depth >= maxDepth) {
        push(path, value);
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === "_id" && depth === 0) continue; // Mongo ObjectId — not PII
        walk(child, path ? `${path}.${key}` : key, depth + 1);
      }
      return;
    }

    push(path, value);
  }

  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id") continue;
    walk(value, key, 0);
  }

  return out;
}

/** Merge per-document field maps into one field-path → values[] map. */
export function mergeFieldMaps(
  maps: Map<string, unknown[]>[],
): Map<string, unknown[]> {
  const merged = new Map<string, unknown[]>();
  for (const map of maps) {
    for (const [path, values] of map) {
      const existing = merged.get(path);
      if (existing) existing.push(...values);
      else merged.set(path, [...values]);
    }
  }
  return merged;
}
