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
  /** Profile photo, if they added one. Otherwise their initials are shown. */
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
  /** The Cairo day this prompt is "today's", e.g. "2026-10-22". */
  activeDate?: string;
};

export type Post = {
  id: string;
  authorId: string;
  /** The circle it was shared in. Only null in the composer before one is picked. */
  circleId: string | null;
  promptId: string | null;
  /** The prompt it answers, if any (loaded with the post). */
  prompt?: { emoji: string; text: string };
  kind: "photo" | "text";
  /** Short-lived signed link to the photo (or a local preview link in the composer). */
  imageUrl?: string;
  /** Where the photo lives in private storage (needed to delete it). */
  imagePath?: string;
  /** Caption for photo posts, or the main text for text posts. */
  text: string;
  /** Background for text posts. */
  background?: ThemeColor;
  location?: string;
  /** When it was posted (ISO time). */
  createdAt: string;
  /** Short age label, e.g. "2h". */
  timeLabel: string;
  /** Reaction counts from other people. The current user's reaction is stored separately. */
  reactions: Record<ReactionKey, number>;
  myReaction: ReactionKey | null;
  commentCount: number;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
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
  /** Free text like "This weekend". Can be empty. */
  whenLabel: string;
  /** When it was created (ISO time). */
  createdAt: string;
  /** "Closes in 5h", "Locked in" or "Closed". */
  deadlineLabel: string;
  options: PollOption[];
  myVote: string | null;
  /** "decided" once it's locked in or its voting time has run out. */
  status: "open" | "decided";
  /** True when its creator locked it in (rather than time running out). */
  lockedIn: boolean;
};

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "reaction"
  | "comment"
  | "circle_invite"
  | "circle_joined"
  | "plan_created"
  | "plan_vote"
  | "plan_locked";

/** One in-app notification (created by the database when something happens). */
export type AppNotification = {
  id: string;
  type: NotificationType;
  /** Who did it (their profile is loaded with the list). */
  actorId: string | null;
  createdAt: string;
  read: boolean;
  /** Reaction key, vote count, or the winning plan option. */
  detail?: string;
  circle?: { name: string; emoji: string };
  pollQuestion?: string;
  commentText?: string;
  /** The existing screen it opens. */
  href: string;
};

export type ReminderTime = "morning" | "afternoon" | "evening" | "surprise";

export type Settings = {
  privateProfile: boolean;
  showActivity: boolean;
  reduceMotion: boolean;
};
