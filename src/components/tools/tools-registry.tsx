"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApprovalBadge } from "@/components/ui/status-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tool = {
  id: string;
  name: string;
  vendor: string;
  domain: string;
  approvalStatus: string;
};

const approvalStatusOptions = [
  { value: "approved", label: "Approved" },
  { value: "unapproved", label: "Unapproved" },
  { value: "under_review", label: "Under review" },
];

export function ToolsRegistry({ tools }: { tools: Tool[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    vendor: "",
    domain: "",
    approvalStatus: "unapproved",
  });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function setStatus(id: string, approvalStatus: string | null) {
    if (!approvalStatus) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus }),
      });
      if (!res.ok) {
        setError("Failed to update tool status");
        return;
      }
      refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tools/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(
          "Failed to remove tool (it may still be referenced by findings)",
        );
        return;
      }
      refresh();
    });
  }

  function addTool(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to add domain");
        return;
      }
      setForm({
        name: "",
        vendor: "",
        domain: "",
        approvalStatus: "unapproved",
      });
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            Add recognised domain
          </CardTitle>
          <CardDescription>
            New AI tools appear constantly — early curation is intentional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addTool} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="tool-name">Tool name</Label>
                <Input
                  id="tool-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ChatGPT"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tool-vendor">Vendor</Label>
                <Input
                  id="tool-vendor"
                  required
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="OpenAI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tool-domain">Domain</Label>
                <Input
                  id="tool-domain"
                  required
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="chat.openai.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.approvalStatus}
                  items={approvalStatusOptions}
                  onValueChange={(v) =>
                    setForm({ ...form, approvalStatus: v ?? "unapproved" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="unapproved">Unapproved</SelectItem>
                    <SelectItem value="under_review">Under review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={pending}>
              Add domain
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Tool</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Change status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell>
                  <span className="font-medium">{tool.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {tool.vendor}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-[13px]">
                  {tool.domain}
                </TableCell>
                <TableCell>
                  <ApprovalBadge status={tool.approvalStatus} />
                </TableCell>
                <TableCell>
                  <Select
                    value={tool.approvalStatus}
                    items={approvalStatusOptions}
                    onValueChange={(v) => setStatus(tool.id, v)}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="unapproved">Unapproved</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    className="text-destructive"
                    onClick={() => remove(tool.id)}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
