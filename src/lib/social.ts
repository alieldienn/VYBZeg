/*
 * Friends and circles: loading and changing them in Supabase from the browser.
 *
 * Every call runs as the logged-in user, so the database's Row Level Security
 * rules (supabase/migrations) decide what is allowed. The checks here are only
 * for friendly messages; they are not the security.
 */
import { createClient } from "@/lib/supabase/client";
import { profileToUser } from "@/lib/supabase/avatars";
import { failure, type Result } from "@/lib/supabase/errors";
import type { Circle, CircleActivity, CircleInvite, CircleRole, FriendRequest, ThemeColor, User } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { cleanUsernameInput, usernameError } from "@/lib/validation";

const PROFILE_COLUMNS = "id, username, display_name, avatar_path, avatar_hue, bio, area";

export type SocialData = {
  /** Profiles of everyone the screens may show: friends, requests, circle members, inviters. */
  users: User[];
  friendIds: string[];
  requests: FriendRequest[];
  circles: Circle[];
  invites: CircleInvite[];
};

export async function fetchSocial(userId: string): Promise<Result<{ data?: SocialData }>> {
  const supabase = createClient();

  const [friendships, memberships, invites] = await Promise.all([
    supabase.from("friendships").select("requester_id, addressee_id, status, created_at"),
    supabase.from("circle_members").select("circle_id").eq("user_id", userId),
    supabase
      .from("circle_invites")
      .select("id, circle_id, inviter_id, created_at, circles(name, emoji, color)")
      .eq("invitee_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  const firstError = friendships.error ?? memberships.error ?? invites.error;
  if (firstError) return failure(firstError, "We couldn't load your circles and friends.");

  const circleIds = (memberships.data ?? []).map((m) => m.circle_id);
  const circleRows = circleIds.length
    ? await supabase
        .from("circles")
        .select(
          "id, name, description, emoji, color, created_at, circle_members(user_id, role, joined_at), circle_invites(id, invitee_id, inviter_id)",
        )
        .in("id", circleIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (circleRows.error) return failure(circleRows.error, "We couldn't load your circles.");

  // Friends and requests. A request the other person declined still looks
  // "sent" to you, so declining isn't announced to the sender.
  const friendIds: string[] = [];
  const requests: FriendRequest[] = [];
  for (const f of friendships.data ?? []) {
    const outgoing = f.requester_id === userId;
    const otherId = outgoing ? f.addressee_id : f.requester_id;
    if (f.status === "accepted") friendIds.push(otherId);
    else if (outgoing) requests.push({ userId: otherId, direction: "outgoing", createdAt: f.created_at });
    else if (f.status === "pending") requests.push({ userId: otherId, direction: "incoming", createdAt: f.created_at });
  }

  const circles = (circleRows.data ?? []).map(toCircle);
  const circleInvites: CircleInvite[] = (invites.data ?? [])
    .filter((invite) => invite.circles)
    .map((invite) => ({
      id: invite.id,
      circleId: invite.circle_id,
      circleName: invite.circles!.name,
      circleEmoji: invite.circles!.emoji,
      circleColor: invite.circles!.color as ThemeColor,
      inviterId: invite.inviter_id,
      createdAt: invite.created_at,
    }));

  // Load the profile of every person mentioned above (except you).
  const ids = new Set<string>([
    ...friendIds,
    ...requests.map((r) => r.userId),
    ...circles.flatMap((c) => [...c.memberIds, ...c.invitedIds, ...(c.invites ?? []).map((i) => i.inviterId)]),
    ...circleInvites.map((i) => i.inviterId),
  ]);
  ids.delete(userId);
  let users: User[] = [];
  if (ids.size) {
    const profiles = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", [...ids]);
    if (profiles.error) return failure(profiles.error, "We couldn't load your friends.");
    users = (profiles.data ?? []).map(profileToUser);
  }

  return { data: { users, friendIds, requests, circles, invites: circleInvites } };
}

type CircleRow = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  created_at: string;
  circle_members: { user_id: string; role: CircleRole; joined_at: string }[];
  circle_invites: { id: string; invitee_id: string; inviter_id: string }[];
};

const ROLE_ORDER: Record<CircleRole, number> = { owner: 0, admin: 1, member: 2 };

function toCircle(row: CircleRow): Circle {
  const members = [...row.circle_members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joined_at.localeCompare(b.joined_at),
  );
  // Real activity for now: who created and joined the circle (posts and plans join later).
  const activity: CircleActivity[] = [...row.circle_members]
    .sort((a, b) => b.joined_at.localeCompare(a.joined_at))
    .map((m) => ({
      id: `join-${m.user_id}`,
      userId: m.user_id,
      kind: "join",
      text: m.role === "owner" ? "created the circle" : "joined the circle",
      timeLabel: timeAgo(m.joined_at),
    }));

  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color as ThemeColor,
    description: row.description ?? "",
    memberIds: members.map((m) => m.user_id),
    invitedIds: row.circle_invites.map((i) => i.invitee_id),
    roles: Object.fromEntries(row.circle_members.map((m) => [m.user_id, m.role])),
    invites: row.circle_invites.map((i) => ({ id: i.id, inviteeId: i.invitee_id, inviterId: i.inviter_id })),
    activity,
    streak: 0,
    newToday: 0,
  };
}

// ----------------------------------------------------------------- friends ---

/** Send a friend request by exact username (or accept theirs if they asked first). */
export async function sendFriendRequest(userId: string, rawUsername: string): Promise<Result<{ message?: string }>> {
  const username = cleanUsernameInput(rawUsername.replace(/^@/, ""));
  const formatProblem = usernameError(username);
  if (formatProblem) return { error: formatProblem };

  const supabase = createClient();
  const found = await supabase.rpc("find_profile_by_username", { p_username: username });
  if (found.error) return failure(found.error);
  const person = found.data?.[0];
  if (!person) return { error: `No one on VYBZ has the username @${username}. Check the spelling.` };
  if (person.id === userId) return { error: "That's you! Try a friend's username." };

  const existing = await supabase
    .from("friendships")
    .select("requester_id, status")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${person.id}),and(requester_id.eq.${person.id},addressee_id.eq.${userId})`,
    )
    .maybeSingle();
  if (existing.error) return failure(existing.error);

  if (existing.data) {
    const iSent = existing.data.requester_id === userId;
    const { status } = existing.data;
    if (status === "accepted") return { error: `You're already friends with @${username}.` };
    if (iSent) return { error: `You already sent @${username} a request.` };
    if (status === "pending") {
      // They already asked you: adding them back means yes.
      const accepted = await respondToRequest(userId, person.id, true);
      return accepted.error ? accepted : { message: `You're now friends with @${username}!` };
    }
    // You declined them earlier and changed your mind: replace it with your own request.
    const removed = await supabase.from("friendships").delete().eq("requester_id", person.id).eq("addressee_id", userId);
    if (removed.error) return failure(removed.error);
  }

  const inserted = await supabase.from("friendships").insert({ addressee_id: person.id });
  if (inserted.error) {
    return inserted.error.code === "23505"
      ? { error: `You and @${username} already have a pending request.` }
      : failure(inserted.error);
  }
  return { message: `Friend request sent to @${username}.` };
}

export async function respondToRequest(userId: string, requesterId: string, accept: boolean): Promise<Result> {
  const { error, count } = await createClient()
    .from("friendships")
    .update({ status: accept ? "accepted" : "rejected" }, { count: "exact" })
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) return failure(error);
  if (!count) return { error: "This request no longer exists." };
  return {};
}

/** Cancel a request you sent, or remove an existing friend. */
export async function removeFriendship(userId: string, otherId: string): Promise<Result> {
  const { error } = await createClient()
    .from("friendships")
    .delete()
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`);
  return error ? failure(error) : {};
}

// ----------------------------------------------------------------- circles ---

export async function createCircle(input: {
  name: string;
  description: string;
  emoji: string;
  color: ThemeColor;
  inviteeIds: string[];
}): Promise<Result<{ id?: string; warning?: string }>> {
  const supabase = createClient();
  // The id is made here so we know it without reading the row back
  // (you only become a member a moment after the insert, via a database trigger).
  const id = crypto.randomUUID();
  const created = await supabase.from("circles").insert({
    id,
    name: input.name.trim(),
    description: input.description.trim() || null,
    emoji: input.emoji,
    color: input.color,
  });
  if (created.error) return failure(created.error, "We couldn't create your circle. Please try again.");

  if (input.inviteeIds.length) {
    const invited = await inviteToCircle(id, input.inviteeIds);
    if (invited.error) return { id, warning: "Circle created, but the invites didn't go through. Try inviting again." };
  }
  return { id };
}

export async function inviteToCircle(circleId: string, inviteeIds: string[]): Promise<Result> {
  const { error } = await createClient()
    .from("circle_invites")
    .insert(inviteeIds.map((inviteeId) => ({ circle_id: circleId, invitee_id: inviteeId })));
  if (error?.code === "42501") return { error: "You can only invite your friends who aren't in this circle yet." };
  if (error?.code === "23505") return { error: "Someone you picked is already invited." };
  return error ? failure(error) : {};
}

export async function cancelInvite(inviteId: string): Promise<Result> {
  const { error, count } = await createClient().from("circle_invites").delete({ count: "exact" }).eq("id", inviteId);
  if (error) return failure(error);
  return count ? {} : { error: "That invite was already accepted or removed." };
}

export async function acceptInvite(circleId: string): Promise<Result> {
  const { error } = await createClient().rpc("accept_circle_invite", { p_circle_id: circleId });
  if (error?.code === "42501" && !/jwt/i.test(error.message)) return { error: "This invite no longer exists." };
  return error ? failure(error) : {};
}

export async function leaveCircle(userId: string, circleId: string): Promise<Result> {
  const { error, count } = await createClient()
    .from("circle_members")
    .delete({ count: "exact" })
    .eq("circle_id", circleId)
    .eq("user_id", userId);
  if (error) return failure(error);
  return count ? {} : { error: "Owners can't leave their own circle. You can delete it instead." };
}

export async function removeMember(circleId: string, memberId: string): Promise<Result> {
  const { error, count } = await createClient()
    .from("circle_members")
    .delete({ count: "exact" })
    .eq("circle_id", circleId)
    .eq("user_id", memberId);
  if (error) return failure(error);
  return count ? {} : { error: "You don't have permission to remove this member." };
}

export async function deleteCircle(circleId: string): Promise<Result> {
  const { error, count } = await createClient().from("circles").delete({ count: "exact" }).eq("id", circleId);
  if (error) return failure(error);
  return count ? {} : { error: "Only the owner can delete this circle." };
}
