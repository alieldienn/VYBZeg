/*
 * Leftover sample data. Only the Plans screen still uses it (sample polls,
 * the people who voted, and the circles they belong to) until Stage 7
 * connects polls to Supabase. Everything else now comes from the database.
 */
import type { Circle, Poll, Settings, User } from "./types";

export const CURRENT_USER_ID = "u-me";

export const SAMPLE_USERS: User[] = [
  {
    id: CURRENT_USER_ID,
    name: "Malak Adel",
    username: "malak.adel",
    avatarHue: 270,
    bio: "coffee > sleep ☕ always down for a plan",
    area: "Maadi, Cairo",
  },
  { id: "u-youssef", name: "Youssef Khaled", username: "yousseff", avatarHue: 205, area: "Zamalek" },
  { id: "u-nour", name: "Nour Hassan", username: "nourhassan", avatarHue: 320, area: "Heliopolis" },
  { id: "u-omar", name: "Omar Tarek", username: "omartarek", avatarHue: 160, area: "Maadi" },
  { id: "u-farida", name: "Farida Samir", username: "farida.s", avatarHue: 290, area: "New Cairo" },
  { id: "u-ziad", name: "Ziad Mostafa", username: "ziadm", avatarHue: 30, area: "Dokki" },
  { id: "u-hana", name: "Hana Ibrahim", username: "hana.ib", avatarHue: 340, area: "Nasr City" },
  { id: "u-karim", name: "Karim Fawzy", username: "kfawzy", avatarHue: 225, area: "Sheikh Zayed" },
  { id: "u-laila", name: "Laila Ashraf", username: "lailaa", avatarHue: 255, area: "Mohandessin" },
  { id: "u-seif", name: "Seif Ahmed", username: "seif.ahmed", avatarHue: 185, area: "Maadi" },
  { id: "u-mariam", name: "Mariam Hossam", username: "mariamh", avatarHue: 300, area: "Heliopolis" },
  { id: "u-adam", name: "Adam Sherif", username: "adam.sh", avatarHue: 120, area: "October" },
];

export const SAMPLE_CIRCLES: Circle[] = [
  {
    id: "c-squad",
    name: "The Squad",
    emoji: "🫶",
    color: "violet",
    description: "Friends since first grade. Chaos guaranteed.",
    memberIds: [CURRENT_USER_ID, "u-youssef", "u-nour", "u-omar", "u-farida", "u-ziad"],
    invitedIds: [],
    streak: 23,
    newToday: 4,
    activity: [
      { id: "a-1", userId: "u-youssef", kind: "post", text: "posted a café vibe", timeLabel: "12m" },
      { id: "a-2", userId: "u-youssef", kind: "plan", text: "started a plan: Thursday night", timeLabel: "1h" },
      { id: "a-3", userId: "u-farida", kind: "react", text: "reacted 🔥 to Nour's plate", timeLabel: "3h" },
      { id: "a-4", userId: "u-nour", kind: "post", text: "answered “What's on your plate?”", timeLabel: "6h" },
    ],
  },
  {
    id: "c-ballers",
    name: "Friday Ballers",
    emoji: "⚽",
    color: "lime",
    description: "5-a-side every Friday. No excuses, no exceptions.",
    memberIds: [CURRENT_USER_ID, "u-omar", "u-ziad", "u-karim", "u-seif", "u-adam"],
    invitedIds: [],
    streak: 8,
    newToday: 2,
    activity: [
      { id: "a-5", userId: "u-omar", kind: "plan", text: "started a plan: football or padel?", timeLabel: "40m" },
      { id: "a-6", userId: "u-seif", kind: "join", text: "joined the circle", timeLabel: "2d" },
      { id: "a-7", userId: "u-adam", kind: "react", text: "reacted 😂 to Omar's traffic pic", timeLabel: "1h" },
    ],
  },
  {
    id: "c-study",
    name: "Exam Szn",
    emoji: "📚",
    color: "midnight",
    description: "Library survivors. Running on coffee and group notes.",
    memberIds: [CURRENT_USER_ID, "u-hana", "u-laila", "u-mariam", "u-nour"],
    invitedIds: [],
    streak: 12,
    newToday: 1,
    activity: [
      { id: "a-8", userId: "u-hana", kind: "post", text: "shared a small win", timeLabel: "2h" },
      { id: "a-9", userId: "u-hana", kind: "plan", text: "locked in: study café after finals", timeLabel: "1d" },
    ],
  },
  {
    id: "c-sahel",
    name: "Sahel '27",
    emoji: "🌊",
    color: "ocean",
    description: "Planning the summer trip. For real this time.",
    memberIds: [CURRENT_USER_ID, "u-youssef", "u-farida", "u-hana", "u-karim", "u-laila", "u-mariam"],
    invitedIds: ["u-adam"],
    streak: 5,
    newToday: 3,
    activity: [
      { id: "a-10", userId: "u-karim", kind: "post", text: "posted a desert throwback", timeLabel: "5h" },
      { id: "a-11", userId: CURRENT_USER_ID, kind: "plan", text: "started a plan: which weekend?", timeLabel: "1d" },
      { id: "a-12", userId: "u-laila", kind: "join", text: "joined the circle", timeLabel: "3d" },
    ],
  },
];

export const SAMPLE_POLLS: Poll[] = [
  {
    id: "poll-1",
    circleId: "c-squad",
    creatorId: "u-youssef",
    question: "Where are we going Thursday night?",
    whenLabel: "Thu · 8 PM",
    deadlineLabel: "Closes in 5h",
    status: "open",
    myVote: null,
    options: [
      { id: "o-1", label: "Rooftop café", category: "cafe", detail: "Zamalek", voterIds: ["u-youssef", "u-farida"] },
      { id: "o-2", label: "Gaming night at Omar's", category: "gaming", detail: "FC tournament", voterIds: ["u-omar", "u-ziad"] },
      { id: "o-3", label: "Koshary run", category: "food", detail: "Downtown", voterIds: ["u-nour"] },
      { id: "o-4", label: "Movie night", category: "cinema", detail: "Cinema or at home", voterIds: [] },
    ],
  },
  {
    id: "poll-2",
    circleId: "c-ballers",
    creatorId: "u-omar",
    question: "Friday: football or padel?",
    whenLabel: "Fri · 6 PM",
    deadlineLabel: "Closes tomorrow",
    status: "open",
    myVote: "o-5",
    options: [
      { id: "o-5", label: "5-a-side football", category: "football", detail: "Maadi pitch", voterIds: ["u-omar", "u-seif"] },
      { id: "o-6", label: "Padel doubles", category: "padel", detail: "New Cairo courts", voterIds: ["u-karim", "u-ziad", "u-adam"] },
      { id: "o-7", label: "PS night if it rains", category: "gaming", voterIds: [] },
    ],
  },
  {
    id: "poll-3",
    circleId: "c-sahel",
    creatorId: CURRENT_USER_ID,
    question: "Sahel weekend: which dates work?",
    whenLabel: "July",
    deadlineLabel: "Closes Sunday",
    status: "open",
    myVote: "o-9",
    options: [
      { id: "o-8", label: "Jul 10 – 12", category: "beach", voterIds: ["u-karim", "u-hana"] },
      { id: "o-9", label: "Jul 17 – 19", category: "beach", voterIds: ["u-youssef", "u-farida", "u-mariam"] },
      { id: "o-10", label: "Jul 24 – 26", category: "beach", voterIds: ["u-laila"] },
    ],
  },
  {
    id: "poll-4",
    circleId: "c-study",
    creatorId: "u-hana",
    question: "Celebration after finals?",
    whenLabel: "Sat · 4 PM",
    deadlineLabel: "Closed",
    status: "decided",
    myVote: "o-11",
    options: [
      { id: "o-11", label: "Brunch café", category: "cafe", detail: "Heliopolis", voterIds: ["u-hana", "u-laila", "u-mariam"] },
      { id: "o-12", label: "Nile felucca ride", category: "outing", detail: "Corniche", voterIds: ["u-nour"] },
    ],
  },
];

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
