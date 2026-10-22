"use client";

import Link from "next/link";
import { CalendarDays, Check, Clock, Lock, PartyPopper } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PLAN_CATEGORIES } from "@/lib/constants";
import { CURRENT_USER_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { Poll, User } from "@/lib/types";
import { cn, leadingOption, optionVotes, pluralize, totalVotes } from "@/lib/utils";

/** A plan poll. Tap an option to vote; tap it again to take your vote back. */
export function PollCard({ poll, showCircle = true }: { poll: Poll; showCircle?: boolean }) {
  const { vote, closePoll, showToast, getUser, getCircle, me } = useVybz();
  const circle = getCircle(poll.circleId);
  const creator = getUser(poll.creatorId);
  const total = totalVotes(poll);
  const decided = poll.status === "decided";
  const showResults = decided || poll.myVote !== null;
  const leader = leadingOption(poll);
  const isMine = poll.creatorId === CURRENT_USER_ID;

  function handleVote(optionId: string) {
    const removing = poll.myVote === optionId;
    vote(poll.id, optionId);
    if (!removing) showToast("Vote counted");
  }

  function handleClose() {
    closePoll(poll.id);
    showToast(`Plan locked: ${leader.label}`);
  }

  return (
    <article className="flex flex-col rounded-[28px] border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-center gap-2.5">
        {creator && <Avatar user={creator} size="sm" />}
        <p className="min-w-0 flex-1 truncate text-xs text-muted">
          <span className="font-semibold text-fg">{isMine ? "You" : creator?.name.split(" ")[0]}</span> asked
          {showCircle && circle && (
            <>
              {" "}
              in{" "}
              <Link href={`/circles/${circle.id}`} className="font-medium text-fg hover:underline">
                {circle.emoji} {circle.name}
              </Link>
            </>
          )}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            decided ? "bg-success/10 text-success" : "bg-brand/15 text-brand-soft",
          )}
        >
          {decided ? <Lock className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
          {poll.deadlineLabel}
        </span>
      </header>

      <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{poll.question}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        {poll.whenLabel}
      </p>

      <ul className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const votes = optionVotes(poll, option);
          const percent = total ? Math.round((votes / total) * 100) : 0;
          const mine = poll.myVote === option.id;
          const winner = decided && option.id === leader.id;
          const voters = [...option.voterIds.map(getUser), ...(mine ? [me] : [])].filter((u): u is User => Boolean(u));
          const category = PLAN_CATEGORIES[option.category];
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={decided}
                aria-pressed={mine}
                onClick={() => handleVote(option.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition-all duration-200",
                  mine || winner ? "border-brand/60" : "border-line hover:border-line-strong",
                  !decided && "active:scale-[0.99]",
                  decided && !winner && "opacity-60",
                )}
              >
                {/* Result bar */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                    mine || winner ? "bg-brand/25" : "bg-white/[0.08]",
                  )}
                  style={{ width: showResults ? `${percent}%` : "0%" }}
                />
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-xl" aria-hidden>
                  {category.emoji}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{option.label}</span>
                    {mine && <Check className="h-4 w-4 shrink-0 text-brand-soft" aria-label="Your vote" />}
                  </span>
                  <span className="block truncate text-xs text-muted">{option.detail ?? category.label}</span>
                </span>
                {showResults && (
                  <span className="relative flex shrink-0 items-center gap-2">
                    {voters.length > 0 && (
                      <span className="hidden sm:block">
                        <AvatarStack users={voters} max={3} size="xs" />
                      </span>
                    )}
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{percent}%</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        {decided ? (
          <p className="flex items-center gap-1.5 font-semibold text-success">
            <PartyPopper className="h-4 w-4" aria-hidden />
            Plan locked: {leader.label}
          </p>
        ) : (
          <p>
            {pluralize(total, "vote")}
            {poll.myVote ? " · tap your pick again to undo" : " · tap an option to vote"}
          </p>
        )}
        {isMine && !decided && (
          <Button size="sm" variant="secondary" onClick={handleClose} disabled={total === 0}>
            <Lock className="h-3.5 w-3.5" />
            Lock in plan
          </Button>
        )}
      </footer>
    </article>
  );
}
