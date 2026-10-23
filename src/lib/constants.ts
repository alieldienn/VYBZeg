import type { PlanCategory, ReactionKey, ReminderTime, Settings, ThemeColor } from "./types";

export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "lol", emoji: "😂", label: "Haha" },
  { key: "love", emoji: "😍", label: "Love it" },
  { key: "care", emoji: "🫶", label: "Support" },
  { key: "wow", emoji: "😮", label: "Wow" },
];

/** Gradient backgrounds used by text posts and circle covers. */
export const THEME_GRADIENTS: Record<ThemeColor, string> = {
  violet: "bg-linear-to-br from-brand-strong via-brand to-glow",
  midnight: "bg-linear-to-br from-elevated via-violet-950 to-brand-strong",
  sunset: "bg-linear-to-br from-fuchsia-600 via-rose-500 to-orange-400",
  ocean: "bg-linear-to-br from-sky-600 via-indigo-600 to-violet-700",
  lime: "bg-linear-to-br from-lime-400 via-emerald-500 to-teal-600",
};

export const THEME_LABELS: Record<ThemeColor, string> = {
  violet: "Violet",
  midnight: "Midnight",
  sunset: "Sunset",
  ocean: "Ocean",
  lime: "Lime",
};

export const PLAN_CATEGORIES: Record<PlanCategory, { emoji: string; label: string }> = {
  cafe: { emoji: "☕", label: "Café" },
  football: { emoji: "⚽", label: "Football" },
  padel: { emoji: "🎾", label: "Padel" },
  gaming: { emoji: "🎮", label: "Gaming" },
  outing: { emoji: "🌆", label: "Outing" },
  food: { emoji: "🍔", label: "Food" },
  cinema: { emoji: "🍿", label: "Cinema" },
  beach: { emoji: "🌊", label: "Beach" },
};

/** One-tap ideas offered when creating a new plan. */
export const PLAN_SUGGESTIONS: { label: string; category: PlanCategory; detail?: string }[] = [
  { label: "Café hangout", category: "cafe", detail: "Zamalek" },
  { label: "5-a-side football", category: "football", detail: "Maadi pitch" },
  { label: "Padel doubles", category: "padel", detail: "New Cairo courts" },
  { label: "Gaming night", category: "gaming", detail: "FC tournament" },
  { label: "Koshary run", category: "food", detail: "Downtown" },
  { label: "Movie night", category: "cinema", detail: "Cinema or at home" },
  { label: "Nile walk", category: "outing", detail: "Corniche" },
  { label: "Sahel day trip", category: "beach", detail: "North Coast" },
];

export const CIRCLE_EMOJIS = ["🫶", "⚽", "📚", "🌊", "🎮", "🍕", "🎧", "✨"];

export const REMINDER_TIMES: { value: ReminderTime; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "surprise", label: "Surprise me" },
];

export const LIMITS = {
  textPost: 280,
  caption: 200,
  bio: 120,
  circleName: 30,
  pollQuestion: 80,
  pollOption: 40,
  maxPollOptions: 6,
  maxImageMB: 10,
} as const;

/** Settings everyone starts with. (Only "Reduce motion" can be changed so far.) */
export const DEFAULT_SETTINGS: Settings = {
  dailyReminder: true,
  reminderTime: "surprise",
  notifyReactions: true,
  notifyPlans: true,
  notifyCircles: false,
  privateProfile: true,
  showActivity: true,
  reduceMotion: false,
};
