/*
 * In-app notifications: Supabase calls from the browser.
 *
 * Notifications are created by the database itself (triggers in
 * supabase/migrations/20261023160000_notifications.sql) when something really
 * happens: friend requests, reactions, comments, invites, joins and plans.
 * Row Level Security means you only ever load, mark or clear your OWN.
 */
import { profileToUser } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { AppNotification, NotificationType, User } from "@/lib/types";

const NOTIFICATION_SELECT = `id, type, actor_id, post_id, circle_id, poll_id, comment_id, detail, created_at, read_at,
  actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_path, avatar_hue),
  circle:circles!notifications_circle_id_fkey(name, emoji),
  poll:polls!notifications_poll_id_fkey(question),
  comment:comments!notifications_comment_id_fkey(content)`;

/** Where tapping a notification takes you (existing screens only). */
function linkFor(type: NotificationType, circleId: string | null) {
  switch (type) {
    case "friend_request":
    case "friend_accepted":
      return "/friends";
    case "circle_invite":
      return "/circles"; // Invites are answered on the Circles screen.
    case "plan_created":
    case "plan_vote":
    case "plan_locked":
      return "/plans";
    default:
      // Reactions, comments and joins: the circle the post or person is in.
      return circleId ? `/circles/${circleId}` : "/";
  }
}

/** Your newest notifications, plus the profiles of the people in them. */
export async function fetchNotifications(limit = 50): Promise<Result<{ notifications?: AppNotification[]; users?: User[] }>> {
  const { data, error } = await createClient()
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return failure(error, "We couldn't load your notifications.");

  const users = new Map<string, User>();
  const notifications = (data ?? []).map((row): AppNotification => {
    if (row.actor) users.set(row.actor.id, profileToUser(row.actor));
    const type = row.type as NotificationType;
    return {
      id: row.id,
      type,
      actorId: row.actor_id,
      createdAt: row.created_at,
      read: row.read_at !== null,
      detail: row.detail ?? undefined,
      // These are null when you can no longer see the thing (e.g. you left the circle).
      circle: row.circle ?? undefined,
      pollQuestion: row.poll?.question,
      commentText: row.comment?.content,
      href: linkFor(type, row.circle_id),
    };
  });
  return { notifications, users: [...users.values()] };
}

/** How many notifications you haven't read yet. */
export async function countUnread(): Promise<Result<{ count?: number }>> {
  const { count, error } = await createClient()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return failure(error);
  return { count: count ?? 0 };
}

export async function markAllRead(): Promise<Result> {
  const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  return error ? failure(error, "We couldn't mark your notifications as read.") : {};
}

export async function markRead(id: string): Promise<Result> {
  const { error } = await createClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  return error ? failure(error) : {};
}
