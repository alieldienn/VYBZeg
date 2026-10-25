"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import {
  fetchBlocked,
  fetchPrivacy,
  unblockUser,
  updatePrivacy,
  type CircleInvitesFrom,
  type FriendRequestsFrom,
  type Privacy,
} from "@/lib/safety";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";

const REQUEST_HINTS: Record<FriendRequestsFrom, string> = {
  everyone: "Anyone who knows your exact username can send you a request.",
  friends_of_friends: "Only people who share at least one friend with you can send you a request.",
  nobody: "No one can send you requests. You can still send them yourself.",
};

/** Profile → Privacy: who can reach you, and the people you blocked. Saved to your account. */
export function PrivacySettings() {
  const { me, showToast, postsChanged, reloadSocial } = useVybz();
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [blocked, setBlocked] = useState<User[] | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPrivacy(me.id).then((result) => {
      if (!cancelled) setPrivacy(result.privacy ?? { friendRequestsFrom: "everyone", circleInvitesFrom: "friends" });
    });
    fetchBlocked().then((result) => {
      if (!cancelled) setBlocked(result.users ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [me.id]);

  async function change(changes: Partial<Privacy>) {
    if (!privacy) return;
    const before = privacy;
    setPrivacy({ ...privacy, ...changes }); // Show it right away…
    const result = await updatePrivacy(me.id, changes);
    if (result.error) {
      setPrivacy(before); // …and undo it if saving failed.
      showToast(result.error, "error");
    } else {
      showToast("Privacy setting saved");
    }
  }

  async function unblock(user: User) {
    setUnblocking(user.id);
    const result = await unblockUser(user.id);
    setUnblocking(null);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    setBlocked((current) => (current ?? []).filter((u) => u.id !== user.id));
    showToast(`${user.name.split(" ")[0]} is unblocked`);
    postsChanged();
    void reloadSocial();
  }

  return (
    <>
      <div className="py-3.5">
        <p className="text-sm font-medium">Who can send you friend requests</p>
        {privacy ? (
          <>
            <Segmented
              label="Who can send you friend requests"
              className="mt-2"
              value={privacy.friendRequestsFrom}
              onChange={(friendRequestsFrom) => change({ friendRequestsFrom })}
              options={[
                { value: "everyone", label: "Everyone" },
                { value: "friends_of_friends", label: "Friends of friends" },
                { value: "nobody", label: "No one" },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">{REQUEST_HINTS[privacy.friendRequestsFrom]}</p>
          </>
        ) : (
          <div className="mt-2 h-11 animate-pulse rounded-2xl bg-elevated" />
        )}
      </div>

      <div className="py-3.5">
        <p className="text-sm font-medium">Who can invite you to circles</p>
        {privacy ? (
          <>
            <Segmented
              label="Who can invite you to circles"
              className="mt-2"
              value={privacy.circleInvitesFrom}
              onChange={(circleInvitesFrom: CircleInvitesFrom) => change({ circleInvitesFrom })}
              options={[
                { value: "friends", label: "Any friend" },
                { value: "nobody", label: "No one" },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">
              {privacy.circleInvitesFrom === "friends"
                ? "Your friends can invite you. You always choose whether to join."
                : "No one can invite you. You can still create your own circles."}
            </p>
          </>
        ) : (
          <div className="mt-2 h-11 animate-pulse rounded-2xl bg-elevated" />
        )}
      </div>

      <div className="py-3.5">
        <p className="text-sm font-medium">Blocked people</p>
        {blocked === null ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
          </p>
        ) : blocked.length === 0 ? (
          <p className="mt-1 text-xs text-muted">
            You haven&apos;t blocked anyone. To block someone, tap ⋯ next to them or on one of their vibes.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {blocked.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-1.5">
                <Avatar user={user} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-subtle">@{user.username}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => unblock(user)} disabled={unblocking === user.id}>
                  {unblocking === user.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-3 py-3.5 text-sm leading-relaxed">
        <li>
          <span className="font-medium">Your profile</span>
          <span className="block text-xs text-muted">
            Only visible to your friends, people in your circles, and people you invite or who invite you.
          </span>
        </li>
        <li>
          <span className="font-medium">Your vibes</span>
          <span className="block text-xs text-muted">
            Only the people you share each one with see it: all your friends, or the members of one circle. Nothing on
            VYBZ is public.
          </span>
        </li>
        <li>
          <span className="font-medium">Reports</span>
          <span className="block text-xs text-muted">
            Reports are private. The person you report isn&apos;t told who reported them.
          </span>
        </li>
      </ul>
    </>
  );
}
