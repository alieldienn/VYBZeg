"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useVybz } from "@/lib/store";
import { CircleCard } from "./CircleCard";
import { InvitesPanel } from "./InvitesPanel";
import { NewCircleSheet } from "./NewCircleSheet";

export function CirclesView() {
  const { circles, social, reloadSocial } = useVybz();
  const [creating, setCreating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Fetch fresh invites and circles whenever this screen opens.
  useEffect(() => {
    void reloadSocial();
  }, [reloadSocial]);

  async function retry() {
    setRetrying(true);
    await reloadSocial();
    setRetrying(false);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Circles"
        description="Private groups for your closest people."
        action={
          <>
            <Link href="/friends" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <UsersRound className="h-4 w-4" />
              Friends
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New circle
            </Button>
          </>
        }
      />

      {social.status === "error" ? (
        <div className="rounded-[28px] border border-danger/30 bg-danger/[0.06] px-6 py-10 text-center" role="alert">
          <p className="font-display text-lg font-semibold">Couldn&apos;t load your circles</p>
          <p className="mt-1 text-sm text-muted">{social.error}</p>
          <Button variant="secondary" className="mt-5" onClick={retry} disabled={retrying}>
            <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Try again
          </Button>
        </div>
      ) : social.status === "loading" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading circles" role="status">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-[28px] bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <InvitesPanel />
          {circles.length === 0 && (
            <p className="mb-4 text-sm text-muted">
              You&apos;re not in any circles yet. Start one for your closest people, or wait for a friend to invite you.
            </p>
          )}
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
        </>
      )}
      <NewCircleSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
