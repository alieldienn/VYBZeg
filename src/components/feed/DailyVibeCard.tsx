"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame } from "lucide-react";
import { AvatarStack } from "@/components/ui/Avatar";
import { buttonStyles } from "@/components/ui/Button";
import { useDailyVibe } from "@/lib/hooks/usePosts";
import { pluralize } from "@/lib/utils";

/** Today's shared prompt. The daily reason to open the app. */
export function DailyVibeCard() {
  const { status, vibe } = useDailyVibe();

  if (status === "loading") {
    return <div className="h-48 animate-pulse rounded-[28px] border border-brand/25 bg-surface" role="status" aria-label="Loading today's vibe" />;
  }
  // No prompt at all (or it failed to load): the feed is still usable, so stay quiet.
  if (!vibe?.prompt) return null;

  const { prompt, answeredBy, postedToday, streak, isToday } = vibe;
  const answered = answeredBy.length + (postedToday ? 1 : 0);

  return (
    <section
      aria-labelledby="daily-vibe-title"
      className="relative overflow-hidden rounded-[28px] border border-brand/25 bg-surface p-5 sm:p-6"
    >
      {/* Soft purple glow in the background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand/30 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-glow/15 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-soft" />
            {isToday ? "Today's Vibe" : "Latest Vibe"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {streak > 0 ? `${streak}-day streak` : "Post today to start a streak"}
          </span>
        </div>

        <h2 id="daily-vibe-title" className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">
          <span className="mr-2" aria-hidden>
            {prompt.emoji}
          </span>
          {prompt.text}
        </h2>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            {answeredBy.length > 0 && <AvatarStack users={answeredBy} max={4} size="sm" />}
            <span>
              {answered === 0 ? (
                "Be the first in your circles to answer"
              ) : (
                <>
                  <span className="font-semibold text-fg">{pluralize(answered, "person", "people")}</span> in your circles
                  answered
                </>
              )}
            </span>
          </div>
          {postedToday ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm font-semibold text-success">
              <Check className="h-4 w-4" aria-hidden />
              You&apos;re in for today
            </span>
          ) : (
            <Link href={`/post?prompt=${prompt.id}`} className={buttonStyles()}>
              Share your vibe
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
