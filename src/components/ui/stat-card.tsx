import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 21st.dev–style statistics card pattern on shadcn Card */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning" | "destructive";
}) {
  const iconStyles = {
    default: "border-border text-muted-foreground",
    primary: "border-primary/30 bg-primary/5 text-primary",
    warning: "border-warning/30 bg-warning/10 text-[var(--warning)]",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-5">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl border",
            iconStyles,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="space-y-1">
          <div className="font-heading text-2xl font-semibold tracking-tight">
            {value}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
          {hint ? (
            <p className="pt-1 text-xs text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
