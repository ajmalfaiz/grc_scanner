"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionField } from "@/lib/discovery-connection-fields";
import { cn } from "@/lib/utils";

export function DiscoveryFieldControl({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: ConnectionField;
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.name}`;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        field.fullWidth && "sm:col-span-2",
      )}
    >
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {field.label}
        {field.required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>

      {field.type === "select" && field.options ? (
        <Select
          value={value}
          items={field.options}
          onValueChange={(next) => {
            if (next != null) onChange(next);
          }}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          rows={3}
          className="min-h-16 resize-none text-sm"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.hint ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {field.hint}
        </p>
      ) : null}
    </div>
  );
}
