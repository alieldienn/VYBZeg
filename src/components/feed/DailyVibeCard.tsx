"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame } from "lucide-react";
import { AvatarStack } from "@/components/ui/Avatar";
import { buttonStyles } from "@/components/ui/Button";
import { PROMPTS, SAMPLE_STREAK, TODAY_ANSWERED_COUNT, TODAY_PROMPT_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";

/** Today's shared prompt. The daily reason to open the app. */
export function DailyVibeCard() {
  const { me, posts, getUser } = useVybz();
  const prompt = PROMPTS.find((p) => p.id === TODAY_PROMPT_ID)!;
  const todaysPosts = posts.filter((post) => post.promptId === TODAY_PROMPT_ID);
  const postedToday = todaysPosts.some((post) => post.authorId === me.id);
  const answeredBy = todaysPosts
    .filter((post) => post.authorId !== me.id)
    .map((post) => getUser(post.authorId))
    .filter((user): user is User => Boolean(user));
  const streak = SAMPLE_STREAK + (postedToday ? 1 : 0);

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
            Today&apos;s Vibe
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {streak}-day streak
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
            <AvatarStack users={answeredBy} max={4} size="sm" />
            <span>
              <span className="font-semibold text-fg">{TODAY_ANSWERED_COUNT + (postedToday ? 1 : 0)}</span> friends
              answered
            </span>
          </div>
          {postedToday ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm font-semibold text-success">
              <Check className="h-4 w-4" aria-hidden />
              You&apos;re in for today
            </span>
          ) : (
            <Link href="/post" className={buttonStyles()}>
              Share your vibe
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
