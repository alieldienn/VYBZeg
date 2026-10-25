/*
 * Safety: blocking, reporting and privacy settings (Supabase calls from the browser).
 *
 * The database does the real work: a block ends the friendship and hides
 * each other's posts, comments and chat messages; a report saves a copy of
 * what was reported; the privacy settings are checked whenever someone sends
 * a friend request or a circle invite. See supabase/migrations.
 */
import { profileToUser } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { User } from "@/lib/types";

// ------------------------------------------------------------------ blocks ---

export async function blockUser(userId: string): Promise<Result> {
  const { error } = await createClient().from("user_blocks").insert({ blocked_id: userId });
  // Already blocked counts as done.
  if (error && error.code !== "23505") return failure(error, "We couldn't block them. Please try again.");
  return {};
}

export async function unblockUser(userId: string): Promise<Result> {
  const { error } = await createClient().from("user_blocks").delete().eq("blocked_id", userId);
  return error ? failure(error, "We couldn't unblock them. Please try again.") : {};
}

/** The people you blocked, newest first. */
export async function fetchBlocked(): Promise<Result<{ users?: User[] }>> {
  const { data, error } = await createClient()
    .from("user_blocks")
    .select("created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_path, avatar_hue)")
    .order("created_at", { ascending: false });
  if (error) return failure(error, "We couldn't load the people you blocked.");
  return { users: (data ?? []).flatMap((row) => (row.blocked ? [profileToUser(row.blocked)] : [])) };
}

// ----------------------------------------------------------------- reports ---

export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "self_harm" | "impersonation" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: "harassment", label: "Bullying or harassment", description: "Insults, threats or targeting someone" },
  { value: "hate", label: "Hate speech", description: "Attacks on people for who they are" },
  { value: "sexual", label: "Nudity or sexual content", description: "Including anything involving minors" },
  { value: "violence", label: "Violence or dangerous acts", description: "Threats, graphic violence, dangerous challenges" },
  { value: "self_harm", label: "Self-harm or suicide", description: "Someone may be at risk" },
  { value: "impersonation", label: "Pretending to be someone", description: "A fake or copied account" },
  { value: "spam", label: "Spam or scam", description: "Ads, fake offers, links you didn't ask for" },
  { value: "other", label: "Something else", description: "Tell us more below" },
];

export const REPORT_DETAILS_MAX = 500;

/** What is being reported. The database works out who posted it and keeps a copy. */
export type ReportTarget =
  | { kind: "user"; userId: string }
  | { kind: "post"; postId: string }
  | { kind: "comment"; commentId: string }
  | { kind: "message"; messageId: string };

export async function report(target: ReportTarget, reason: ReportReason, details: string): Promise<Result> {
  const { error } = await createClient()
    .from("reports")
    .insert({
      kind: target.kind,
      reported_user_id: target.kind === "user" ? target.userId : null,
      post_id: target.kind === "post" ? target.postId : null,
      comment_id: target.kind === "comment" ? target.commentId : null,
      message_id: target.kind === "message" ? target.messageId : null,
      reason,
      details: details.trim().slice(0, REPORT_DETAILS_MAX) || null,
    });
  if (error?.code === "42501") return { error: "You can only report things you can see." };
  if (error?.code === "22023") return { error: "You can't report yourself." };
  return error ? failure(error, "Your report didn't send. Please try again.") : {};
}

// --------------------------------------------------------- privacy settings ---

export type FriendRequestsFrom = "everyone" | "friends_of_friends" | "nobody";
export type CircleInvitesFrom = "friends" | "nobody";
export type Privacy = { friendRequestsFrom: FriendRequestsFrom; circleInvitesFrom: CircleInvitesFrom };

export async function fetchPrivacy(userId: string): Promise<Result<{ privacy?: Privacy }>> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("friend_requests_from, circle_invites_from")
    .eq("id", userId)
    .single();
  if (error) return failure(error, "We couldn't load your privacy settings.");
  return {
    privacy: {
      friendRequestsFrom: data.friend_requests_from as FriendRequestsFrom,
      circleInvitesFrom: data.circle_invites_from as CircleInvitesFrom,
    },
  };
}

export async function updatePrivacy(userId: string, changes: Partial<Privacy>): Promise<Result> {
  const { error } = await createClient()
    .from("profiles")
    .update({
      ...(changes.friendRequestsFrom && { friend_requests_from: changes.friendRequestsFrom }),
      ...(changes.circleInvitesFrom && { circle_invites_from: changes.circleInvitesFrom }),
    })
    .eq("id", userId);
  return error ? failure(error, "Your privacy setting didn't save. Please try again.") : {};
}
