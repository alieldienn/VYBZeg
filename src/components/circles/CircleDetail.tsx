"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarHeart,
  Flame,
  Heart,
  ImageIcon,
  Loader2,
  LogOut,
  MessagesSquare,
  Pencil,
  PenLine,
  Sparkles,
  Trash2,
  UserPlus,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewPlanSheet } from "@/components/plans/NewPlanSheet";
import { SafetyButton } from "@/components/safety/SafetyButton";
import { SafetySheet } from "@/components/safety/SafetySheet";
import { PollCard } from "@/components/plans/PollCard";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Segmented } from "@/components/ui/Segmented";
import { Tag } from "@/components/ui/Tag";
import { REACTIONS, THEME_GRADIENTS } from "@/lib/constants";
import { acceptInvite, cancelInvite, deleteCircle, leaveCircle, removeMember } from "@/lib/social";
import { daysAgoIso } from "@/lib/dates";
import { usePolls } from "@/lib/hooks/usePolls";
import { usePosts } from "@/lib/hooks/usePosts";
import { useVybz } from "@/lib/store";
import type { ActivityKind, Circle, CircleInvite, CircleRole, ReactionKey, User } from "@/lib/types";
import { agoText, cn, pluralize, reactionCount } from "@/lib/utils";
import { CircleChat } from "./CircleChat";
import { CircleIcon } from "./CircleIcon";
import { EditCircleIconSheet } from "./EditCircleIconSheet";
import { InviteSheet } from "./InviteSheet";

const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  post: ImageIcon,
  plan: CalendarHeart,
  join: UserPlus,
  react: Heart,
};

const ROLE_LABELS: Record<CircleRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export function CircleDetail({ id }: { id: string }) {
  const { circles, invites, social } = useVybz();
  const circle = circles.find((c) => c.id === id);
  const invite = invites.find((i) => i.circleId === id);

  if (circle) return <MemberView circle={circle} />;
  if (social.status === "loading") return <CircleSkeleton />;
  if (invite) return <InvitePreview invite={invite} />;

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl" aria-hidden>
        🫥
      </p>
      <h1 className="mt-4 font-display text-2xl font-bold">Circle not found</h1>
      <p className="mt-2 text-sm text-muted">
        {social.status === "error"
          ? social.error
          : "It may have been deleted, or you're not a member. Circles are private: you need an invite to see one."}
      </p>
      <Link href="/circles" className={buttonStyles({ className: "mt-6" })}>
        Back to circles
      </Link>
    </div>
  );
}

export function CircleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse pt-16 lg:pt-24" role="status" aria-label="Loading circle">
      <div className="h-56 rounded-[32px] bg-surface" />
      <div className="mt-8 h-40 rounded-[28px] bg-surface" />
    </div>
  );
}

/** What someone invited (but not yet a member) sees: no posts or members, just the invite. */
function InvitePreview({ invite }: { invite: CircleInvite }) {
  const router = useRouter();
  const { getUser, runSocial } = useVybz();
  const [busy, setBusy] = useState<"join" | "decline" | null>(null);
  const inviter = getUser(invite.inviterId);

  async function respond(join: boolean) {
    setBusy(join ? "join" : "decline");
    const ok = await runSocial(
      join ? acceptInvite(invite.circleId) : cancelInvite(invite.id),
      join ? `You joined ${invite.circleEmoji} ${invite.circleName}` : "Invite declined",
    );
    setBusy(null);
    if (ok && !join) router.push("/circles");
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <PageHeader title={invite.circleName} back={{ href: "/circles", label: "Circles" }} />
      <section className={cn("rounded-[32px] p-6 text-center sm:p-8", THEME_GRADIENTS[invite.circleColor])}>
        <CircleIcon
          emoji={invite.circleEmoji}
          imageUrl={invite.circleImageUrl}
          size="h-24 w-24"
          emojiSize="text-6xl"
          className="mx-auto"
        />
        <h2 className="mt-3 font-display text-2xl font-bold text-white">{invite.circleName}</h2>
        <p className="mt-2 text-sm font-medium text-white/90">
          {inviter ? `${inviter.name} (@${inviter.username})` : "A friend"} invited you to join.
        </p>
        <p className="mt-1 text-xs text-white/75">Join to see the members, posts, plans and chat inside.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="glass" onClick={() => respond(false)} disabled={busy !== null}>
            {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Decline
          </Button>
          <Button variant="light" onClick={() => respond(true)} disabled={busy !== null}>
            {busy === "join" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Join circle
          </Button>
        </div>
      </section>
    </div>
  );
}

type Confirm = { kind: "leave" } | { kind: "delete" } | { kind: "remove"; member: User };

function MemberView({ circle }: { circle: Circle }) {
  const router = useRouter();
  const { me, getUser, runSocial } = useVybz();
  const [inviting, setInviting] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [tab, setTab] = useState<"vibes" | "chat">("vibes");
  const [editingIcon, setEditingIcon] = useState(false);
  // A new key each time the icon sheet opens, so it starts from the current icon.
  const [iconSheetKey, setIconSheetKey] = useState(0);
  // The member in the Report / Block sheet. A new key each time starts it fresh.
  const [safetyFor, setSafetyFor] = useState<User | null>(null);
  const [safetyKey, setSafetyKey] = useState(0);
  const feed = usePosts({ circleId: circle.id });
  const plans = usePolls({ circleId: circle.id });

  const myRole = circle.roles?.[me.id] ?? "member";
  const isAdmin = myRole === "owner" || myRole === "admin";
  const members = circle.memberIds.map(getUser).filter((u): u is User => Boolean(u));
  // Open plans first, then decided ones (each newest first).
  const circlePolls = [...plans.polls].sort((a, b) => Number(a.status === "decided") - Number(b.status === "decided"));

  // "This week" numbers from the loaded posts and plans of the last 7 days.
  const weekAgo = daysAgoIso(7);
  const weekPosts = feed.posts.filter((post) => post.createdAt >= weekAgo);
  const weekPlans = plans.polls.filter((poll) => poll.createdAt >= weekAgo);
  const reactionTotals = REACTIONS.map((r) => ({
    ...r,
    total: weekPosts.reduce((sum, post) => sum + reactionCount(post, r.key as ReactionKey), 0),
  }));
  const topReaction = reactionTotals.reduce((best, r) => (r.total > best.total ? r : best), reactionTotals[0]);

  function canRemove(memberId: string) {
    const role = circle.roles?.[memberId];
    if (memberId === me.id || role === "owner") return false;
    return myRole === "owner" || (myRole === "admin" && role === "member");
  }

  async function cancel(inviteId: string) {
    setCancelling(inviteId);
    await runSocial(cancelInvite(inviteId), "Invite cancelled");
    setCancelling(null);
  }

  async function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "remove") {
      return runSocial(removeMember(circle.id, confirm.member.id), `${confirm.member.name} was removed`);
    }
    const ok =
      confirm.kind === "leave"
        ? await runSocial(leaveCircle(me.id, circle.id), `You left ${circle.name}`)
        : await runSocial(deleteCircle(circle.id), `${circle.name} was deleted`);
    if (ok) router.push("/circles");
    return ok;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title={circle.name} back={{ href: "/circles", label: "Circles" }} />

      <section className={cn("relative overflow-hidden rounded-[32px] p-6 sm:p-8", THEME_GRADIENTS[circle.color])}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 text-[160px] leading-none opacity-20 blur-[2px]">
          {circle.emoji}
        </div>
        <div className="relative">
          <div className="flex items-end gap-2">
            <CircleIcon emoji={circle.emoji} imageUrl={circle.imageUrl} size="h-20 w-20" emojiSize="text-5xl" />
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIconSheetKey((n) => n + 1);
                  setEditingIcon(true);
                }}
                className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/45"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                Edit icon
              </button>
            )}
          </div>
          {circle.description && (
            <p className="mt-3 max-w-md text-[15px] font-medium text-white/90 wrap-anywhere">{circle.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white">
            <span className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">
              <UsersRound className="h-3.5 w-3.5" aria-hidden />
              {pluralize(members.length, "member")}
            </span>
            {circle.streak > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">
                <Flame className="h-3.5 w-3.5 text-warning" aria-hidden />
                {circle.streak}-day streak
              </span>
            )}
            {circle.newToday > 0 && (
              <span className="rounded-full bg-black/30 px-3 py-1.5 backdrop-blur">{circle.newToday} new today</span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="light" onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" />
              Invite friends
            </Button>
            <Link href={`/post?circle=${circle.id}`} className={buttonStyles({ variant: "glass" })}>
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
          <Segmented
            label="Circle view"
            value={tab}
            onChange={setTab}
            options={[
              { value: "vibes", label: "Vibes & plans", icon: <ImageIcon className="h-4 w-4" /> },
              { value: "chat", label: "Chat", icon: <MessagesSquare className="h-4 w-4" /> },
            ]}
          />
          {tab === "chat" ? (
            <CircleChat circle={circle} />
          ) : (
            <>
              <section aria-labelledby="recap-title" className="rounded-[28px] border border-line bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="recap-title" className="flex items-center gap-2 font-display text-lg font-semibold">
                    <Sparkles className="h-4 w-4 text-brand-soft" aria-hidden />
                    This week
                  </h2>
                  <Tag tone="soon">Weekly Recap preview</Tag>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <Stat label="Vibes shared" value={feed.status === "ready" ? `${weekPosts.length}${feed.hasMore && weekPosts.length === feed.posts.length ? "+" : ""}` : "–"} />
                  <Stat label="Plans made" value={plans.status === "ready" ? String(weekPlans.length) : "–"} />
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
                      <PollCard key={poll.id} poll={poll} showCircle={false} onChange={plans.updatePoll} />
                    ))}
                  </div>
                </section>
              )}
    
              <section aria-labelledby="circle-posts">
                <h2 id="circle-posts" className="mb-3 font-display text-lg font-semibold">
                  Shared in {circle.name}
                </h2>
                {feed.status === "loading" ? (
                  <div className="h-80 animate-pulse rounded-[28px] bg-surface" role="status" aria-label="Loading vibes" />
                ) : feed.status === "error" ? (
                  <div className="rounded-[28px] border border-danger/30 bg-danger/[0.06] px-6 py-8 text-center" role="alert">
                    <p className="text-sm text-muted">{feed.error}</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={feed.retry}>
                      Try again
                    </Button>
                  </div>
                ) : feed.posts.length > 0 ? (
                  <div className="space-y-4">
                    {feed.posts.map((post) => (
                      <PostCard key={post.id} post={post} onChange={feed.updatePost} onRemove={feed.removePost} />
                    ))}
                    {feed.hasMore && (
                      <div className="flex justify-center">
                        <Button variant="secondary" onClick={feed.loadMore} disabled={feed.loadingMore}>
                          {feed.loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          Load more
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-10 text-center">
                    <p className="font-semibold">No vibes here yet</p>
                    <p className="mt-1 text-sm text-muted">Be the first to share something with {circle.name}.</p>
                    <Link href={`/post?circle=${circle.id}`} className={buttonStyles({ size: "sm", className: "mt-4" })}>
                      Post a vibe
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}
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
              {members.map((member) => {
                const role = circle.roles?.[member.id] ?? "member";
                return (
                  <li key={member.id} className="flex items-center gap-3 py-1.5">
                    <Avatar user={member} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{member.name}</span>
                      <span className="block truncate text-xs text-subtle">@{member.username}</span>
                    </span>
                    {member.id === me.id && <Tag tone="brand">You</Tag>}
                    {role !== "member" && <Tag tone="soon">{ROLE_LABELS[role]}</Tag>}
                    {member.id !== me.id && (
                      <SafetyButton
                        user={member}
                        onOpen={(user) => {
                          setSafetyKey((n) => n + 1);
                          setSafetyFor(user);
                        }}
                      />
                    )}
                    {canRemove(member.id) && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "remove", member })}
                        className="rounded-full p-1.5 text-subtle transition hover:bg-tint/5 hover:text-danger"
                        aria-label={`Remove ${member.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
              {(circle.invites ?? []).map((pending) => {
                const user = getUser(pending.inviteeId);
                const canCancel = pending.inviterId === me.id || isAdmin;
                return (
                  <li key={pending.id} className="flex items-center gap-3 py-1.5">
                    {user && <Avatar user={user} size="sm" className="opacity-60" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted">{user?.name ?? "Invited friend"}</span>
                    <Tag tone="soon">Invited</Tag>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => cancel(pending.id)}
                        disabled={cancelling === pending.id}
                        className="rounded-full p-1.5 text-subtle transition hover:bg-tint/5 hover:text-fg disabled:opacity-50"
                        aria-label={`Cancel invite for ${user?.name ?? "this friend"}`}
                      >
                        {cancelling === pending.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </button>
                    )}
                  </li>
                );
              })}
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
                        {item.userId === me.id ? "You" : user?.name.split(" ")[0]}
                      </span>{" "}
                      {item.text}
                      <span className="block text-xs text-subtle">{agoText(item.timeLabel)}</span>
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          {myRole === "owner" ? (
            <Button variant="danger" className="w-full" onClick={() => setConfirm({ kind: "delete" })}>
              <Trash2 className="h-4 w-4" />
              Delete circle
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirm({ kind: "leave" })}>
              <LogOut className="h-4 w-4" />
              Leave circle
            </Button>
          )}
        </div>
      </div>

      <InviteSheet circle={circle} open={inviting} onClose={() => setInviting(false)} />
      {safetyFor && <SafetySheet key={safetyKey} open onClose={() => setSafetyFor(null)} user={safetyFor} />}
      {isAdmin && (
        <EditCircleIconSheet key={iconSheetKey} circle={circle} open={editingIcon} onClose={() => setEditingIcon(false)} />
      )}
      <NewPlanSheet open={planning} onClose={() => setPlanning(false)} defaultCircleId={circle.id} />
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        danger
        title={
          confirm?.kind === "delete"
            ? `Delete ${circle.name}?`
            : confirm?.kind === "leave"
              ? `Leave ${circle.name}?`
              : `Remove ${confirm?.kind === "remove" ? confirm.member.name : ""}?`
        }
        description={
          confirm?.kind === "delete"
            ? "This deletes the circle for everyone, including its posts and plans. This can't be undone."
            : confirm?.kind === "leave"
              ? "You'll stop seeing this circle's posts and plans. You'll need a new invite to come back."
              : "They'll lose access to this circle's posts and plans. They'd need a new invite to come back."
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete circle" : confirm?.kind === "leave" ? "Leave" : "Remove"}
        onConfirm={confirmAction}
      />
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
