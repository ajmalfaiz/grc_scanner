import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries", () => ({
  getAiTools: vi.fn(),
  addAiTool: vi.fn(),
  updateToolApproval: vi.fn(),
  removeAiTool: vi.fn(),
}));

import { GET, POST } from "@/app/api/tools/route";
import { PATCH, DELETE } from "@/app/api/tools/[id]/route";
import { addAiTool, getAiTools, removeAiTool, updateToolApproval } from "@/lib/queries";

describe("API /api/tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns tools list", async () => {
    vi.mocked(getAiTools).mockResolvedValue([
      {
        id: "1",
        name: "ChatGPT",
        vendor: "OpenAI",
        domain: "chatgpt.com",
        approvalStatus: "approved",
        createdAt: new Date(),
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].name).toBe("ChatGPT");
  });

  it("POST validates required fields", async () => {
    const res = await POST(
      new Request("http://localhost/api/tools", {
        method: "POST",
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST creates a tool", async () => {
    vi.mocked(addAiTool).mockResolvedValue({
      id: "2",
      name: "Claude",
      vendor: "Anthropic",
      domain: "claude.ai",
      approvalStatus: "unapproved",
      createdAt: new Date(),
    });

    const res = await POST(
      new Request("http://localhost/api/tools", {
        method: "POST",
        body: JSON.stringify({
          name: "Claude",
          vendor: "Anthropic",
          domain: "claude.ai",
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(addAiTool).toHaveBeenCalled();
  });

  it("POST returns 409 on duplicate", async () => {
    vi.mocked(addAiTool).mockRejectedValue(new Error("duplicate"));
    const res = await POST(
      new Request("http://localhost/api/tools", {
        method: "POST",
        body: JSON.stringify({
          name: "Claude",
          vendor: "Anthropic",
          domain: "claude.ai",
        }),
      }),
    );
    expect(res.status).toBe(409);
  });
});

describe("API /api/tools/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH updates approval status", async () => {
    vi.mocked(updateToolApproval).mockResolvedValue({
      id: "1",
      name: "ChatGPT",
      vendor: "OpenAI",
      domain: "chatgpt.com",
      approvalStatus: "under_review",
      createdAt: new Date(),
    });

    const res = await PATCH(
      new Request("http://localhost/api/tools/1", {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: "under_review" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("PATCH rejects invalid status", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/tools/1", {
        method: "PATCH",
        body: JSON.stringify({ approvalStatus: "nope" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("DELETE removes a tool", async () => {
    vi.mocked(removeAiTool).mockResolvedValue(undefined);
    const res = await DELETE(
      new Request("http://localhost/api/tools/1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("DELETE returns 409 when findings still reference the tool", async () => {
    vi.mocked(removeAiTool).mockRejectedValue(new Error("referenced"));
    const res = await DELETE(
      new Request("http://localhost/api/tools/1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(res.status).toBe(409);
  });
});
