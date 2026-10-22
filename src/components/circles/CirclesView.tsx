"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useVybz } from "@/lib/store";
import { CircleCard } from "./CircleCard";
import { NewCircleSheet } from "./NewCircleSheet";

export function CirclesView() {
  const { circles } = useVybz();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Circles"
        description="Private groups for your closest people."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New circle
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {circles.map((circle) => (
          <div key={circle.id} className="animate-fade-up">
            <CircleCard circle={circle} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-line-strong p-6 text-center text-muted transition hover:border-brand/50 hover:bg-brand/5 hover:text-fg"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-elevated">
            <Plus className="h-6 w-6" />
          </span>
          <span className="font-semibold">Start a new circle</span>
          <span className="text-sm">Gym crew, cousins, uni gang…</span>
        </button>
      </div>
      <NewCircleSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
