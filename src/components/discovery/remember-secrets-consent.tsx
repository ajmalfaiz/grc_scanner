"use client";

import { cn } from "@/lib/utils";

export function RememberSecretsConsent({
  checked,
  onCheckedChange,
  id = "remember-secrets",
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">
          Save password / keys in this browser
        </span>
        <span className="block text-xs leading-snug text-muted-foreground">
          Only when you explicitly agree. Otherwise secrets are never stored and
          you’ll be asked for them on every rescan.
        </span>
      </span>
    </label>
  );
}
