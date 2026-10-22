/*
 * Shared data shapes for VYBZ.
 * These are written to map cleanly onto database tables later (Supabase),
 * so screens only depend on these types, not on where the data comes from.
 */

export type User = {
  id: string;
  name: string;
  username: string;
  /** Hue (0-360) used to colour the generated avatar. */
  avatarHue: number;
  /** Optional real photo. Sample users use generated initials instead. */
  avatarUrl?: string;
  bio?: string;
  area?: string;
};

export type ReactionKey = "fire" | "lol" | "love" | "care" | "wow";

export type ThemeColor = "violet" | "midnight" | "sunset" | "ocean" | "lime";

export type Prompt = {
  id: string;
  emoji: string;
  text: string;
};

export type Post = {
  id: string;
  authorId: string;
  /** null means "all friends". */
  circleId: string | null;
  promptId: string | null;
  kind: "photo" | "text";
  imageUrl?: string;
  /** Caption for photo posts, or the main text for text posts. */
  text: string;
  /** Background for text posts. */
  background?: ThemeColor;
  location?: string;
  /** Pre-formatted time, e.g. "2h". Becomes a real timestamp with the backend. */
  timeLabel: string;
  /** Reaction counts from other people. The current user's reaction is stored separately. */
  reactions: Record<ReactionKey, number>;
  myReaction: ReactionKey | null;
};

export type ActivityKind = "post" | "plan" | "join" | "react";

export type CircleActivity = {
  id: string;
  userId: string;
  kind: ActivityKind;
  text: string;
  timeLabel: string;
};

export type CircleRole = "owner" | "admin" | "member";

export type Circle = {
  id: string;
  name: string;
  emoji: string;
  color: ThemeColor;
  description: string;
  memberIds: string[];
  /** Friends invited but not joined yet. */
  invitedIds: string[];
  activity: CircleActivity[];
  /** Days in a row someone in the circle posted. */
  streak: number;
  newToday: number;
  /** Role of each member, by user id (real circles only). */
  roles?: Record<string, CircleRole>;
  /** Pending invites, so the right people can cancel them (real circles only). */
  invites?: { id: string; inviteeId: string; inviterId: string }[];
  /** True for leftover sample circles used by the sample feed and plans. */
  sample?: boolean;
};

/** An invitation for the logged-in user to join a circle. */
export type CircleInvite = {
  id: string;
  circleId: string;
  circleName: string;
  circleEmoji: string;
  circleColor: ThemeColor;
  inviterId: string;
  createdAt: string;
};

/** A pending friend request involving the logged-in user. */
export type FriendRequest = {
  userId: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
};

export type PlanCategory =
  | "cafe"
  | "football"
  | "padel"
  | "gaming"
  | "outing"
  | "food"
  | "cinema"
  | "beach";

export type PollOption = {
  id: string;
  label: string;
  category: PlanCategory;
  detail?: string;
  /** Votes from other people. The current user's vote is stored on the poll. */
  voterIds: string[];
};

export type Poll = {
  id: string;
  circleId: string;
  creatorId: string;
  question: string;
  whenLabel: string;
  deadlineLabel: string;
  options: PollOption[];
  myVote: string | null;
  status: "open" | "decided";
};

export type ReminderTime = "morning" | "afternoon" | "evening" | "surprise";

export type Settings = {
  dailyReminder: boolean;
  reminderTime: ReminderTime;
  notifyReactions: boolean;
  notifyPlans: boolean;
  notifyCircles: boolean;
  privateProfile: boolean;
  showActivity: boolean;
  reduceMotion: boolean;
};
