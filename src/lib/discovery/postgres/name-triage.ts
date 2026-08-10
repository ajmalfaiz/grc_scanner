import {
  isFreeTextType,
  triageColumns as triageColumnsGeneric,
  triageColumnsWithOptionalLlm as triageColumnsWithOptionalLlmGeneric,
} from "@/lib/discovery/shared/name-triage";
import type { ColumnCatalog, NameTriageHit } from "@/lib/discovery/postgres/types";

export function isFreeTextColumn(column: ColumnCatalog): boolean {
  return isFreeTextType(column.dataType, column.udtName);
}

export function triageColumn(column: ColumnCatalog): NameTriageHit | null {
  return triageColumnsGeneric([column])[0] ?? null;
}

export function triageColumns(columns: ColumnCatalog[]): NameTriageHit[] {
  return triageColumnsGeneric(columns);
}

export async function triageColumnsWithOptionalLlm(
  columns: ColumnCatalog[],
  mode: string | undefined,
): Promise<{ hits: NameTriageHit[]; llmAssistUsed: boolean }> {
  return triageColumnsWithOptionalLlmGeneric(columns, mode);
}
