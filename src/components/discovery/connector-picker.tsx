"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  connectorCards,
  type ConnectorId,
} from "@/lib/discovery-mock-data";
import { cn } from "@/lib/utils";

export function ConnectorPicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<ConnectorId | null>(null);

  const selectedCard = connectorCards.find((c) => c.scanId === selected);

  function handleContinue() {
    if (!selected) return;
    router.push(`/discovery/connect/${selected}`);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4">
      <header className="shrink-0 space-y-1">
        <p className="text-xs text-muted-foreground">Step 1 of 4</p>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Choose a connector
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Pick a data source to scan. To rescan an earlier run, open{" "}
          <Link
            href="/discovery/saved"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Saved connections
          </Link>
          . Greyed cards are not available in this prototype.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {connectorCards.map((card) => {
          const Icon = card.icon;
          const isSelected = card.enabled && card.scanId === selected;

          if (!card.enabled) {
            return (
              <div
                key={card.id}
                aria-disabled="true"
                className="flex cursor-not-allowed items-start gap-2.5 rounded-lg border border-border bg-card p-3 opacity-40"
              >
                <Icon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {card.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelected(card.scanId!)}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors",
                isSelected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-foreground/25",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isSelected ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {card.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-end border-t border-border pt-3">
        <Button
          size="lg"
          disabled={!selected}
          onClick={handleContinue}
          className="min-w-44"
        >
          {selectedCard
            ? `Continue with ${selectedCard.name}`
            : "Continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
