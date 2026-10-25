"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BellOff,
  CalendarHeart,
  CheckCheck,
  Heart,
  Lock,
  MessageCircle,
  UserCheck,
  UserPlus,
  UsersRound,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { REACTIONS } from "@/lib/constants";
import { fetchNotifications, markAllRead, markRead } from "@/lib/notifications";
import { useVybz } from "@/lib/store";
import type { AppNotification, NotificationType, User } from "@/lib/types";
import { agoText, cn, timeAgo } from "@/lib/utils";

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  reaction: Heart,
  comment: MessageCircle,
  circle_invite: UsersRound,
  circle_joined: UsersRound,
  plan_created: CalendarHeart,
  plan_vote: Vote,
  plan_locked: Lock,
};

type ListState = { status: "loading" | "ready" | "error"; error?: string; items: AppNotification[] };

export function NotificationsView() {
  const router = useRouter();
  const { getUser, mergeUsers, showToast, refreshUnread } = useVybz();
  const [list, setList] = useState<ListState>({ status: "loading", items: [] });
  const [marking, setMarking] = useState(false);

  /** Puts a loaded list on screen (or shows the error). */
  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchNotifications>>) => {
      if (!result.notifications) {
        if (result.expired) router.push("/login");
        setList((current) => (current.status === "ready" ? current : { status: "error", error: result.error, items: [] }));
        return;
      }
      mergeUsers(result.users ?? []);
      setList({ status: "ready", items: result.notifications });
      void refreshUnread();
    },
    [mergeUsers, refreshUnread, router],
  );

  // `cancelled` ignores an answer that arrives after you left the screen.
  useEffect(() => {
    let cancelled = false;
    fetchNotifications().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  function retry() {
    setList({ status: "loading", items: [] });
    fetchNotifications().then(apply);
  }

  const unread = list.items.filter((item) => !item.read).length;

  async function readAll() {
    setMarking(true);
    const result = await markAllRead();
    setMarking(false);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    setList((current) => ({ ...current, items: current.items.map((item) => ({ ...item, read: true })) }));
    void refreshUnread();
  }

  function open(item: AppNotification) {
    if (item.read) return;
    // Mark it read straight away; the link opens at the same time.
    setList((current) => ({ ...current, items: current.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)) }));
    void markRead(item.id).then(() => refreshUnread());
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Notifications"
        back={{ href: "/", label: "Home" }}
        action={
          unread > 0 && (
            <Button size="sm" variant="secondary" onClick={readAll} disabled={marking}>
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
          )
        }
      />

      {list.status === "loading" ? (
        <div className="space-y-2" role="status" aria-label="Loading notifications">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : list.status === "error" ? (
        <div className="rounded-[28px] border border-danger/30 bg-danger/[0.06] px-6 py-8 text-center" role="alert">
          <p className="text-sm text-muted">{list.error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : list.items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated text-brand-soft">
            <BellOff className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 font-display text-lg font-semibold">You&apos;re all caught up</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Friend requests, reactions, comments, circle invites and plans will show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} actor={item.actorId ? getUser(item.actorId) : undefined} onOpen={() => open(item)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ item, actor, onOpen }: { item: AppNotification; actor?: User; onOpen: () => void }) {
  const Icon = TYPE_ICONS[item.type];
  return (
    <Link
      href={item.href}
      onClick={onOpen}
      className={cn(
        "flex items-start gap-3 rounded-3xl border p-3.5 transition active:scale-[0.99]",
        item.read ? "border-line bg-surface hover:bg-elevated" : "border-brand/30 bg-brand/[0.08] hover:bg-brand/[0.12]",
      )}
    >
      <span className="relative shrink-0">
        {actor ? (
          <Avatar user={actor} size="md" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-muted">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
        {actor && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-raised text-brand-soft ring-2 ring-surface">
            <Icon className="h-3 w-3" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug wrap-anywhere">
          <Message item={item} actor={actor} />
        </span>
        <span className="mt-1 block text-xs text-subtle">{agoText(timeAgo(item.createdAt))}</span>
      </span>
      {!item.read && (
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" role="img" aria-label="Unread" />
      )}
    </Link>
  );
}

/** The sentence for each kind of notification, built only from real data. */
function Message({ item, actor }: { item: AppNotification; actor?: User }) {
  const who = <span className="font-semibold">{actor?.name ?? "Someone"}</span>;
  const circle = item.circle ? (
    <span className="font-medium">
      {item.circle.emoji} {item.circle.name}
    </span>
  ) : (
    "a circle"
  );
  const plan = item.pollQuestion ? <span className="font-medium">&ldquo;{item.pollQuestion}&rdquo;</span> : "a plan";

  switch (item.type) {
    case "friend_request":
      return <>{who} sent you a friend request</>;
    case "friend_accepted":
      return <>{who} accepted your friend request. You&apos;re friends now!</>;
    case "reaction": {
      const emoji = REACTIONS.find((r) => r.key === item.detail)?.emoji ?? "";
      return <>{who} reacted {emoji} to your vibe</>;
    }
    case "comment":
      return (
        <>
          {who} commented{item.commentText ? <>: <span className="text-muted">&ldquo;{item.commentText}&rdquo;</span></> : " on your vibe"}
        </>
      );
    case "circle_invite":
      return <>{who} invited you to join {circle}</>;
    case "circle_joined":
      return <>{who} joined {circle}</>;
    case "plan_created":
      return <>{who} started a plan in {circle}: {plan}</>;
    case "plan_vote": {
      const votes = Number(item.detail ?? 0);
      return (
        <>
          {who} voted on your plan {plan}
          {votes > 1 && <span className="text-muted"> · {votes} votes so far</span>}
        </>
      );
    }
    case "plan_locked":
      return (
        <>
          {who} locked in {plan}
          {item.detail ? <>: <span className="font-semibold text-brand-soft">{item.detail}</span></> : " (no votes)"}
        </>
      );
  }
}
