"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Check, Clock, Loader2, Lock, PartyPopper, Trash2, UsersRound } from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { PLAN_CATEGORIES } from "@/lib/constants";
import { deletePoll, lockPoll, setVote } from "@/lib/polls";
import { useVybz } from "@/lib/store";
import type { Result } from "@/lib/supabase/errors";
import type { Poll, User } from "@/lib/types";
import { cn, leadingOption, optionVotes, pluralize, totalVotes } from "@/lib/utils";

type PollCardProps = {
  poll: Poll;
  showCircle?: boolean;
  /** Called with the updated plan (instantly when you vote, and again to undo if saving fails). */
  onChange: (poll: Poll) => void;
};

/** A plan poll. Tap an option to vote; tap it again to take your vote back. */
export function PollCard({ poll, showCircle = true, onChange }: PollCardProps) {
  const router = useRouter();
  const { showToast, getUser, getCircle, me, pollsChanged } = useVybz();
  const [voting, setVoting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);
  const circle = getCircle(poll.circleId);
  const creator = getUser(poll.creatorId);
  const total = totalVotes(poll);
  const decided = poll.status === "decided";
  const showResults = decided || poll.myVote !== null;
  const leader = leadingOption(poll);
  const isMine = poll.creatorId === me.id;
  const myRole = circle?.roles?.[me.id];
  const canDelete = isMine || myRole === "owner" || myRole === "admin";

  /** Everyone who picked this option, you included. */
  function votersOf(option: Poll["options"][number]) {
    const mine = poll.myVote === option.id;
    return [...option.voterIds.map(getUser), ...(mine ? [me] : [])].filter((u): u is User => Boolean(u));
  }

  /** Shows an error (sending you to log in if needed). Returns true if there was one. */
  function failed(result: Result) {
    if (!result.error) return false;
    showToast(result.error, "error");
    if (result.expired) router.push("/login");
    return true;
  }

  async function handleVote(optionId: string) {
    if (voting || decided) return;
    const before = poll;
    const next = poll.myVote === optionId ? null : optionId;
    onChange({ ...poll, myVote: next }); // Show it right away…
    setVoting(true);
    const result = await setVote(poll.id, before.myVote, next);
    setVoting(false);
    if (failed(result)) {
      onChange(before); // …and undo it if saving failed.
      pollsChanged(); // The plan may have closed meanwhile: reload to show that.
    } else if (next) {
      showToast("Vote counted");
    }
  }

  async function handleLock() {
    setLocking(true);
    const result = await lockPoll(poll.id);
    setLocking(false);
    if (failed(result)) return;
    showToast(`Plan locked: ${leader.label}`);
    pollsChanged();
  }

  async function handleDelete() {
    if (failed(await deletePoll(poll.id))) return false;
    showToast("Plan deleted");
    pollsChanged();
  }

  return (
    <article className="flex flex-col rounded-[28px] border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-center gap-2.5">
        {creator && <Avatar user={creator} size="sm" />}
        <p className="min-w-0 flex-1 truncate text-xs text-muted">
          <span className="font-semibold text-fg">{isMine ? "You" : (creator?.name.split(" ")[0] ?? "Someone")}</span> asked
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

      <h3 className="mt-3 font-display text-xl font-semibold leading-snug wrap-anywhere">{poll.question}</h3>
      {poll.whenLabel && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {poll.whenLabel}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const votes = optionVotes(poll, option);
          const percent = total ? Math.round((votes / total) * 100) : 0;
          const mine = poll.myVote === option.id;
          const winner = decided && total > 0 && option.id === leader.id;
          const voters = votersOf(option);
          const category = PLAN_CATEGORIES[option.category];
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={decided}
                aria-pressed={mine}
                aria-busy={voting}
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
                    mine || winner ? "bg-brand/25" : "bg-tint/[0.08]",
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
                    {voters.length > 0 && <AvatarStack users={voters} max={3} size="xs" />}
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{percent}%</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {showResults && total > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setVotersOpen(!votersOpen)}
            aria-expanded={votersOpen}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-soft hover:underline"
          >
            <UsersRound className="h-3.5 w-3.5" aria-hidden />
            {votersOpen ? "Hide who voted" : "See who voted"}
          </button>
          {votersOpen && (
            <ul className="mt-3 space-y-3 rounded-2xl bg-elevated p-3">
              {poll.options.map((option) => {
                const voters = votersOf(option);
                if (voters.length === 0) return null;
                return (
                  <li key={option.id}>
                    <p className="text-xs font-semibold text-muted">
                      {PLAN_CATEGORIES[option.category].emoji} {option.label} · {pluralize(voters.length, "vote")}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {voters.map((voter) => (
                        <li key={voter.id} className="flex items-center gap-1.5 rounded-full bg-surface py-1 pl-1 pr-2.5 text-xs font-medium">
                          <Avatar user={voter} size="xs" />
                          {voter.id === me.id ? "You" : voter.name}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        {!decided ? (
          <p>
            {pluralize(total, "vote")}
            {poll.myVote ? " · tap your pick again to undo" : " · tap an option to vote"}
          </p>
        ) : total === 0 ? (
          <p>Voting closed with no votes.</p>
        ) : (
          <p className="flex items-center gap-1.5 font-semibold text-success">
            <PartyPopper className="h-4 w-4" aria-hidden />
            {poll.lockedIn ? "Plan locked" : "Voting closed"}: {leader.label}
          </p>
        )}
        <div className="flex items-center gap-1">
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-full p-2 text-subtle transition hover:bg-tint/5 hover:text-danger"
              aria-label="Delete plan"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {isMine && !decided && (
            <Button size="sm" variant="secondary" onClick={handleLock} disabled={total === 0 || locking}>
              {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Lock className="h-3.5 w-3.5" />}
              Lock in plan
            </Button>
          )}
        </div>
      </footer>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this plan?"
        description={`"${poll.question}" and all its votes will be removed for everyone in the circle.`}
        confirmLabel="Delete plan"
        danger
        onConfirm={handleDelete}
      />
    </article>
  );
}
