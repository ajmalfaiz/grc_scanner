import { Suspense } from "react";
import { FindingDetailPanel } from "@/components/findings/finding-detail";
import { FindingsFilters } from "@/components/findings/findings-filters";
import { FindingsTable } from "@/components/findings/findings-table";
import { PageHeader } from "@/components/ui/stat-card";
import {
  getFindingById,
  getFindings,
  getToolNames,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  approval?: string;
  confidence?: string;
  tool?: string;
  id?: string;
}>;

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filters = {
    approval: params.approval,
    confidence: params.confidence,
    tool: params.tool,
  };

  const [allFindings, tools] = await Promise.all([
    getFindings(filters),
    getToolNames(),
  ]);

  const high = allFindings.filter((f) => f.confidence === "high");
  const medium = allFindings.filter((f) => f.confidence === "medium");
  const selected = params.id ? await getFindingById(params.id) : null;

  const query = new URLSearchParams();
  if (params.approval) query.set("approval", params.approval);
  if (params.confidence) query.set("confidence", params.confidence);
  if (params.tool) query.set("tool", params.tool);
  const baseQuery = query.toString();
  const closeHref = baseQuery ? `/findings?${baseQuery}` : "/findings";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Findings"
        description="One row per device–domain pair. High-confidence matches first; medium confidence sits in a separate review queue."
      />

      <div className="mb-5">
        <Suspense fallback={null}>
          <FindingsFilters tools={tools} />
        </Suspense>
      </div>

      <div
        className={
          selected
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
            : "grid gap-6"
        }
      >
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">High confidence</h2>
              <span className="text-xs text-muted-foreground">
                {high.length} findings
              </span>
            </div>
            <FindingsTable
              findings={high}
              selectedId={params.id}
              baseQuery={baseQuery}
            />
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                Medium confidence — review queue
              </h2>
              <span className="text-xs text-muted-foreground">
                {medium.length} findings
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Fuzzy or CDN-shared domains that need human review before treating
              them as definitive AI-tool usage.
            </p>
            <FindingsTable
              findings={medium}
              selectedId={params.id}
              baseQuery={baseQuery}
            />
          </section>
        </div>

        {selected ? (
          <FindingDetailPanel finding={selected} closeHref={closeHref} />
        ) : null}
      </div>
    </main>
  );
}
