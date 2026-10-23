"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { usePolls } from "@/lib/hooks/usePolls";
import { NewPlanSheet } from "./NewPlanSheet";
import { PollCard } from "./PollCard";

export function PlansView() {
  const plans = usePolls();
  const [tab, setTab] = useState<"open" | "decided">("open");
  const [creating, setCreating] = useState(false);

  const open = plans.polls.filter((poll) => poll.status === "open");
  const decided = plans.polls.filter((poll) => poll.status === "decided");
  const shown = tab === "open" ? open : decided;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Plans"
        description="Stop the endless group chat. Vote and go."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        }
      />

      <div className="space-y-5">
        <Segmented
          label="Plan status"
          className="sm:max-w-xs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: `Voting now · ${open.length}` },
            { value: "decided", label: `Decided · ${decided.length}` },
          ]}
        />

        {plans.status === "loading" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-label="Loading plans">
            <div className="h-72 animate-pulse rounded-[28px] bg-surface" />
            <div className="hidden h-72 animate-pulse rounded-[28px] bg-surface lg:block" />
          </div>
        ) : plans.status === "error" ? (
          <div className="rounded-[28px] border border-danger/30 bg-danger/[0.06] px-6 py-8 text-center" role="alert">
            <p className="text-sm text-muted">{plans.error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={plans.retry}>
              Try again
            </Button>
          </div>
        ) : shown.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {shown.map((poll) => (
              <PollCard key={poll.id} poll={poll} onChange={plans.updatePoll} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold">
              {tab === "open" ? "No open plans" : "Nothing decided yet"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {tab === "open" ? "Start one and get the group moving." : "Locked-in plans will show up here."}
            </p>
            {tab === "open" && (
              <Button className="mt-5" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New plan
              </Button>
            )}
          </div>
        )}
      </div>

      <NewPlanSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
