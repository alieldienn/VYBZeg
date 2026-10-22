"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarHeart, Flame, Heart, ImageIcon, PenLine, Sparkles, UserPlus, UsersRound, type LucideIcon } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewPlanSheet } from "@/components/plans/NewPlanSheet";
import { PollCard } from "@/components/plans/PollCard";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Tag } from "@/components/ui/DemoNotice";
import { REACTIONS, THEME_GRADIENTS } from "@/lib/constants";
import { CURRENT_USER_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { ActivityKind, ReactionKey, User } from "@/lib/types";
import { cn, pluralize, reactionCount } from "@/lib/utils";
import { InviteSheet } from "./InviteSheet";

const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  post: ImageIcon,
  plan: CalendarHeart,
  join: UserPlus,
  react: Heart,
};

export function CircleDetail({ id }: { id: string }) {
  const { getCircle, getUser, posts, polls } = useVybz();
  const [inviting, setInviting] = useState(false);
  const [planning, setPlanning] = useState(false);
  const circle = getCircle(id);

  if (!circle) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-5xl" aria-hidden>
          🫥
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold">Circle not found</h1>
        <p className="mt-2 text-sm text-muted">
          It may have been deleted, or it was a demo circle that disappeared when the page refreshed.
        </p>
        <Link href="/circles" className={buttonStyles({ className: "mt-6" })}>
          Back to circles
        </Link>
      </div>
    );
  }

  const members = circle.memberIds.map(getUser).filter((u): u is User => Boolean(u));
  const invited = circle.invitedIds.map(getUser).filter((u): u is User => Boolean(u));
  const circlePosts = posts.filter((post) => post.circleId === circle.id);
  const circlePolls = polls.filter((poll) => poll.circleId === circle.id);

  // Simple numbers for the Weekly Recap preview, worked out from the sample data.
  const reactionTotals = REACTIONS.map((r) => ({
    ...r,
    total: circlePosts.reduce((sum, post) => sum + reactionCount(post, r.key as ReactionKey), 0),
  }));
  const topReaction = reactionTotals.reduce((best, r) => (r.total > best.total ? r : best), reactionTotals[0]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title={circle.name} back={{ href: "/circles", label: "Circles" }} />

      <section className={cn("relative overflow-hidden rounded-[32px] p-6 sm:p-8", THEME_GRADIENTS[circle.color])}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 text-[160px] leading-none opacity-20 blur-[2px]">
          {circle.emoji}
        </div>
        <div className="relative">
          <span className="text-5xl drop-shadow-lg" aria-hidden>
            {circle.emoji}
          </span>
          <p className="mt-3 max-w-md text-[15px] font-medium text-white/90">{circle.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white">
            <span className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">
              <UsersRound className="h-3.5 w-3.5" aria-hidden />
              {pluralize(members.length, "member")}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">
              <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
              {circle.streak}-day streak
            </span>
            {circle.newToday > 0 && (
              <span className="rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">{circle.newToday} new today</span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="light" onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" />
              Invite friends
            </Button>
            <Link href="/post" className={buttonStyles({ variant: "glass" })}>
              <PenLine className="h-4 w-4" />
              Post
            </Link>
            <Button variant="glass" onClick={() => setPlanning(true)}>
              <CalendarHeart className="h-4 w-4" />
              Make a plan
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="recap-title" className="rounded-[28px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recap-title" className="flex items-center gap-2 font-display text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-brand-soft" aria-hidden />
                This week
              </h2>
              <Tag tone="soon">Weekly Recap preview</Tag>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="Vibes shared" value={String(circlePosts.length)} />
              <Stat label="Plans made" value={String(circlePolls.length)} />
              <Stat label="Top reaction" value={topReaction.total > 0 ? topReaction.emoji : "–"} />
            </dl>
            <p className="mt-4 text-xs text-muted">
              Every Friday you&apos;ll get a recap of your circle&apos;s best moments. Coming in a later milestone.
            </p>
          </section>

          {circlePolls.length > 0 && (
            <section aria-labelledby="circle-plans">
              <h2 id="circle-plans" className="mb-3 font-display text-lg font-semibold">
                Plans
              </h2>
              <div className="space-y-4">
                {circlePolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} showCircle={false} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="circle-posts">
            <h2 id="circle-posts" className="mb-3 font-display text-lg font-semibold">
              Shared in {circle.name}
            </h2>
            {circlePosts.length > 0 ? (
              <div className="space-y-4">
                {circlePosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-10 text-center">
                <p className="font-semibold">No vibes here yet</p>
                <p className="mt-1 text-sm text-muted">Post something and pick this circle as the audience.</p>
                <Link href="/post" className={buttonStyles({ size: "sm", className: "mt-4" })}>
                  Post a vibe
                </Link>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <section aria-labelledby="circle-members" className="rounded-[28px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 id="circle-members" className="font-display text-lg font-semibold">
                Members
              </h2>
              <button type="button" onClick={() => setInviting(true)} className="text-xs font-medium text-brand-soft hover:underline">
                + Invite
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-1.5">
                  <Avatar user={member} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                  {member.id === CURRENT_USER_ID && <Tag tone="brand">You</Tag>}
                </li>
              ))}
              {invited.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-1.5 opacity-60">
                  <Avatar user={user} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>
                  <Tag tone="soon">Invited</Tag>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="circle-activity" className="rounded-[28px] border border-line bg-surface p-5">
            <h2 id="circle-activity" className="font-display text-lg font-semibold">
              Activity
            </h2>
            <ol className="mt-3 space-y-3">
              {circle.activity.map((item) => {
                const user = getUser(item.userId);
                const Icon = ACTIVITY_ICONS[item.kind];
                return (
                  <li key={item.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-elevated text-brand-soft">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="text-sm leading-snug text-muted">
                      <span className="font-semibold text-fg">
                        {item.userId === CURRENT_USER_ID ? "You" : user?.name.split(" ")[0]}
                      </span>{" "}
                      {item.text}
                      <span className="block text-xs text-subtle">{item.timeLabel} ago</span>
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      <InviteSheet circle={circle} open={inviting} onClose={() => setInviting(false)} />
      <NewPlanSheet open={planning} onClose={() => setPlanning(false)} defaultCircleId={circle.id} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-elevated px-2 py-3">
      <dd className="font-display text-2xl font-bold">{value}</dd>
      <dt className="mt-0.5 text-[11px] text-muted">{label}</dt>
    </div>
  );
}
