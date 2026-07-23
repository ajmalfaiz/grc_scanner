import { NextResponse } from "next/server";
import { removeAiTool, updateToolApproval } from "@/lib/queries";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const status = body?.approvalStatus;

  if (
    status !== "approved" &&
    status !== "unapproved" &&
    status !== "under_review"
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await updateToolApproval(id, status);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    await removeAiTool(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Cannot remove tool while findings reference it" },
      { status: 409 },
    );
  }
}
