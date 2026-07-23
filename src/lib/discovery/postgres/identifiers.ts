const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Validate then double-quote a Postgres identifier. Rejects unsafe names. */
export function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name.replaceAll('"', '""')}"`;
}

export function quoteQualified(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

export function parseSchemaList(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const schemas = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const schema of schemas) {
    if (!IDENT_RE.test(schema)) {
      throw new Error(`Invalid schema name: ${schema}`);
    }
  }
  return schemas;
}
