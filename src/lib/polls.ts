/*
 * Plans (polls) and votes: Supabase calls from the browser.
 *
 * Every call runs as the logged-in user, so Row Level Security decides what
 * is allowed: you only see plans from circles you're a member of, you vote as
 * yourself, votes can change only while a plan is open, and only the person
 * who made a plan can lock it in. The checks here are only for friendly messages.
 */
import { profileToUser } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { PlanCategory, Poll, User } from "@/lib/types";

/** New plans stay open for voting this long (unless locked in sooner). */
const VOTING_HOURS = 24;
const PERSON_COLUMNS = "id, username, display_name, avatar_path, avatar_hue";

const POLL_SELECT = `id, circle_id, creator_id, question, when_label, created_at, closes_at, closed_at,
  creator:profiles!polls_creator_id_fkey(${PERSON_COLUMNS}),
  poll_options!poll_options_poll_id_fkey(id, option_text, category, detail, position),
  poll_votes!poll_votes_poll_id_fkey(user_id, option_id, voter:profiles!poll_votes_user_id_fkey(${PERSON_COLUMNS}))`;

const CLOSED_MESSAGE = "Voting on this plan has closed.";

/** "Closes in 5h", "Locked in" or "Closed", from the plan's times. */
function deadlineLabel(closesAt: string | null, closedAt: string | null, now: number) {
  if (closedAt) return "Locked in";
  if (!closesAt) return "Open";
  const minutes = Math.ceil((Date.parse(closesAt) - now) / 60000);
  if (minutes <= 0) return "Closed";
  if (minutes < 60) return `Closes in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours <= 24 ? `Closes in ${hours}h` : `Closes in ${Math.round(hours / 24)}d`;
}

/**
 * Newest plans first: every circle you're in, or just one (`circleId`).
 * Also returns the profiles of creators and voters so screens can show them.
 */
export async function fetchPolls(
  userId: string,
  { circleId, limit = 50 }: { circleId?: string; limit?: number } = {},
): Promise<Result<{ polls?: Poll[]; users?: User[] }>> {
  let query = createClient().from("polls").select(POLL_SELECT).order("created_at", { ascending: false }).limit(limit);
  if (circleId) query = query.eq("circle_id", circleId);

  const { data, error } = await query;
  if (error) return failure(error, "We couldn't load your plans.");

  const now = Date.now();
  const users = new Map<string, User>();
  const polls = (data ?? []).map((row): Poll => {
    if (row.creator) users.set(row.creator.id, profileToUser(row.creator));
    let myVote: string | null = null;
    const voters = new Map<string, string[]>();
    for (const vote of row.poll_votes ?? []) {
      if (vote.voter) users.set(vote.voter.id, profileToUser(vote.voter));
      if (vote.user_id === userId) myVote = vote.option_id;
      else voters.set(vote.option_id, [...(voters.get(vote.option_id) ?? []), vote.user_id]);
    }
    const expired = row.closes_at !== null && Date.parse(row.closes_at) <= now;
    return {
      id: row.id,
      circleId: row.circle_id,
      creatorId: row.creator_id,
      question: row.question,
      whenLabel: row.when_label ?? "",
      createdAt: row.created_at,
      deadlineLabel: deadlineLabel(row.closes_at, row.closed_at, now),
      status: row.closed_at || expired ? "decided" : "open",
      lockedIn: Boolean(row.closed_at),
      myVote,
      options: [...(row.poll_options ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((option) => ({
          id: option.id,
          label: option.option_text,
          category: option.category as PlanCategory,
          detail: option.detail ?? undefined,
          voterIds: voters.get(option.id) ?? [],
        })),
    };
  });

  users.delete(userId);
  return { polls, users: [...users.values()] };
}

export type NewPoll = {
  circleId: string;
  question: string;
  whenLabel: string;
  options: { label: string; category: PlanCategory; detail?: string }[];
};

/** Saves a plan and its options together (all or nothing). */
export async function createPoll(input: NewPoll): Promise<Result<{ id?: string }>> {
  const { data, error } = await createClient().rpc("create_poll", {
    p_circle_id: input.circleId,
    p_question: input.question.trim(),
    p_when_label: input.whenLabel,
    p_closes_at: new Date(Date.now() + VOTING_HOURS * 60 * 60 * 1000).toISOString(),
    p_options: input.options.map((option) => ({
      text: option.label.trim(),
      category: option.category,
      detail: option.detail ?? null,
    })),
  });
  if (error?.code === "42501") return { error: "You can only make plans in circles you're a member of." };
  if (error?.code === "22023") return { error: "A plan needs between 2 and 6 options." };
  if (error) return failure(error, "We couldn't create your plan. Please try again.");
  return { id: data };
}

/** Sets your vote on a plan: a new one, a different option, or none (`next = null`). */
export async function setVote(pollId: string, current: string | null, next: string | null): Promise<Result> {
  const votes = createClient().from("poll_votes");
  // RLS limits update/delete to your own vote while the plan is open. When the
  // plan has closed they change nothing (count 0) instead of failing.
  if (current === null && next !== null) {
    const { error } = await votes.insert({ poll_id: pollId, option_id: next });
    if (error?.code === "42501") return { error: CLOSED_MESSAGE };
    if (error?.code === "23505") return { error: "You already voted on this plan. Refresh to see your vote." };
    return error ? failure(error, "Your vote didn't save. Please try again.") : {};
  }
  const { error, count } =
    next === null
      ? await votes.delete({ count: "exact" }).eq("poll_id", pollId)
      : await votes.update({ option_id: next }, { count: "exact" }).eq("poll_id", pollId);
  if (error) return failure(error, "Your vote didn't save. Please try again.");
  return count ? {} : { error: CLOSED_MESSAGE };
}

/** Locks in the plan (creator only). Voting stops and the leading option wins. */
export async function lockPoll(pollId: string): Promise<Result> {
  const { error, count } = await createClient()
    .from("polls")
    .update({ closed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", pollId);
  if (error) return failure(error, "We couldn't lock in the plan. Please try again.");
  return count ? {} : { error: "Only the person who made this plan can lock it in, and only while it's open." };
}

/** Deletes a plan with its options and votes (its creator or a circle admin). */
export async function deletePoll(pollId: string): Promise<Result> {
  const { error, count } = await createClient().from("polls").delete({ count: "exact" }).eq("id", pollId);
  if (error) return failure(error, "We couldn't delete the plan. Please try again.");
  return count ? {} : { error: "You can't delete this plan." };
}
