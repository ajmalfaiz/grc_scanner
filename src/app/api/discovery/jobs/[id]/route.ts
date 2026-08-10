import { NextResponse } from "next/server";

import { getJob } from "@/lib/jobs/job-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found — it may have expired" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    connectorId: job.connectorId,
    label: job.label,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.result,
    error: job.error,
  });
}
