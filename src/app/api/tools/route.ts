import { NextResponse } from "next/server";
import { addAiTool, getAiTools } from "@/lib/queries";

export async function GET() {
  const tools = await getAiTools();
  return NextResponse.json(tools);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, vendor, domain, approvalStatus } = body ?? {};

  if (!name || !vendor || !domain) {
    return NextResponse.json(
      { error: "name, vendor, and domain are required" },
      { status: 400 },
    );
  }

  const status =
    approvalStatus === "approved" ||
    approvalStatus === "unapproved" ||
    approvalStatus === "under_review"
      ? approvalStatus
      : "unapproved";

  try {
    const created = await addAiTool({
      name,
      vendor,
      domain,
      approvalStatus: status,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not add domain (duplicate?)" },
      { status: 409 },
    );
  }
}
