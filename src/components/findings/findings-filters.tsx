"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const approvalOptions = [
  { value: "all", label: "All" },
  { value: "unapproved", label: "Unapproved" },
  { value: "approved", label: "Approved" },
  { value: "under_review", label: "Under review" },
];

const confidenceOptions = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
];

export function FindingsFilters({ tools }: { tools: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const toolOptions = [
    { value: "all", label: "All tools" },
    ...tools.map((tool) => ({ value: tool, label: tool })),
  ];

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("id");
    startTransition(() => {
      router.push(`/findings?${params.toString()}`);
    });
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-4 ${pending ? "opacity-70" : ""}`}
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Approval</Label>
        <Select
          value={searchParams.get("approval") ?? "all"}
          items={approvalOptions}
          onValueChange={(v) => update("approval", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unapproved">Unapproved</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="under_review">Under review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Confidence</Label>
        <Select
          value={searchParams.get("confidence") ?? "all"}
          items={confidenceOptions}
          onValueChange={(v) => update("confidence", v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tool</Label>
        <Select
          value={searchParams.get("tool") ?? "all"}
          items={toolOptions}
          onValueChange={(v) => update("tool", v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tools</SelectItem>
            {tools.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
