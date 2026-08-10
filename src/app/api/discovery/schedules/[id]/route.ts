import { NextResponse } from "next/server";

import {
  deleteSchedule,
  ensureSchedulerRunning,
  getSchedule,
  runScheduleNow,
  setScheduleEnabled,
  toPublicSchedule,
} from "@/lib/jobs/schedule-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  ensureSchedulerRunning();
  const { id } = await params;
  const schedule = getSchedule(id);
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  return NextResponse.json({ schedule: toPublicSchedule(schedule) });
}

export async function PATCH(request: Request, { params }: Params) {
  ensureSchedulerRunning();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const record = (body ?? {}) as { enabled?: boolean; runNow?: boolean };

  if (record.runNow) {
    const job = runScheduleNow(id);
    if (!job) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    return NextResponse.json({ jobId: job.id });
  }

  if (typeof record.enabled === "boolean") {
    const schedule = setScheduleEnabled(id, record.enabled);
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    return NextResponse.json({ schedule: toPublicSchedule(schedule) });
  }

  return NextResponse.json({ error: "Nothing to update — pass enabled or runNow" }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = deleteSchedule(id);
  if (!removed) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
