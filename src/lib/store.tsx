"use client";

/*
 * App-wide state shared by every screen.
 * Milestone 2 is moving this to Supabase one feature at a time:
 *  - Your profile is REAL: loaded on the server; edits are saved to Supabase first.
 *  - Friends, friend requests, circles and circle invites are REAL: loaded from
 *    Supabase in the browser (Row Level Security decides what you can see) and
 *    reloaded after every change.
 *  - "Reduce motion" is remembered on this device (localStorage).
 *  - Posts and polls are still SAMPLE data held in memory (refreshing resets
 *    them) until their stage is connected. The sample "me" has been swapped for
 *    your real account, and the sample circles they mention are kept only so
 *    those posts and polls can still show a circle name.
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { CURRENT_USER_ID, DEFAULT_SETTINGS, SAMPLE_CIRCLES, SAMPLE_POLLS, SAMPLE_POSTS, SAMPLE_USERS } from "./sample-data";
import { fetchSocial, type SocialData } from "./social";
import type { Result } from "./supabase/errors";
import type { Circle, CircleInvite, FriendRequest, Poll, Post, ReactionKey, Settings, User } from "./types";

export type ToastTone = "success" | "error";

type Toast = { id: number; message: string; tone: ToastTone };

type State = {
  users: User[];
  posts: Post[];
  /** Your real circles. */
  circles: Circle[];
  /** Sample circles, only for labelling sample posts and polls. */
  sampleCircles: Circle[];
  polls: Poll[];
  friendIds: string[];
  requests: FriendRequest[];
  invites: CircleInvite[];
  /** Loading status of friends/circles from Supabase. */
  social: { status: "loading" | "ready" | "error"; error?: string };
  settings: Settings;
  toast: Toast | null;
};

type Action =
  | { type: "react"; postId: string; reaction: ReactionKey }
  | { type: "addPost"; post: Post }
  | { type: "vote"; pollId: string; optionId: string }
  | { type: "addPoll"; poll: Poll }
  | { type: "closePoll"; pollId: string }
  | { type: "socialLoaded"; data: SocialData }
  | { type: "socialFailed"; error: string }
  | { type: "updateProfile"; userId: string; changes: Partial<Pick<User, "name" | "username" | "bio" | "area" | "avatarUrl">> }
  | { type: "updateSettings"; changes: Partial<Settings> }
  | { type: "toast"; message: string; tone: ToastTone }
  | { type: "dismissToast"; id: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "react":
      return {
        ...state,
        posts: state.posts.map((post) =>
          post.id === action.postId
            ? { ...post, myReaction: post.myReaction === action.reaction ? null : action.reaction }
            : post,
        ),
      };
    case "addPost":
      return { ...state, posts: [action.post, ...state.posts] };
    case "vote":
      return {
        ...state,
        polls: state.polls.map((poll) =>
          poll.id === action.pollId && poll.status === "open"
            ? { ...poll, myVote: poll.myVote === action.optionId ? null : action.optionId }
            : poll,
        ),
      };
    case "addPoll":
      return { ...state, polls: [action.poll, ...state.polls] };
    case "closePoll":
      return {
        ...state,
        polls: state.polls.map((poll) =>
          poll.id === action.pollId ? { ...poll, status: "decided", deadlineLabel: "Closed" } : poll,
        ),
      };
    case "socialLoaded": {
      const fresh = new Set(action.data.users.map((user) => user.id));
      return {
        ...state,
        users: [...state.users.filter((user) => !fresh.has(user.id)), ...action.data.users],
        circles: action.data.circles,
        friendIds: action.data.friendIds,
        requests: action.data.requests,
        invites: action.data.invites,
        social: { status: "ready" },
      };
    }
    case "socialFailed":
      // Keep showing what was loaded before, if anything.
      return { ...state, social: { status: state.social.status === "ready" ? "ready" : "error", error: action.error } };
    case "updateProfile":
      return {
        ...state,
        users: state.users.map((user) => (user.id === action.userId ? { ...user, ...action.changes } : user)),
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case "toast":
      return { ...state, toast: { id: (state.toast?.id ?? 0) + 1, message: action.message, tone: action.tone } };
    case "dismissToast":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
  }
}

/** Starting state: sample posts/polls with the sample "me" replaced by your real account. */
function initialState({ me }: { me: User }): State {
  const swap = (id: string) => (id === CURRENT_USER_ID ? me.id : id);
  return {
    users: SAMPLE_USERS.map((user) => (user.id === CURRENT_USER_ID ? me : user)),
    posts: SAMPLE_POSTS.map((post) => ({ ...post, authorId: swap(post.authorId) })),
    polls: SAMPLE_POLLS.map((poll) => ({
      ...poll,
      creatorId: swap(poll.creatorId),
      options: poll.options.map((option) => ({ ...option, voterIds: option.voterIds.map(swap) })),
    })),
    circles: [],
    sampleCircles: SAMPLE_CIRCLES.map((circle) => ({
      ...circle,
      sample: true,
      memberIds: circle.memberIds.map(swap),
      activity: circle.activity.map((item) => ({ ...item, userId: swap(item.userId) })),
    })),
    friendIds: [],
    requests: [],
    invites: [],
    social: { status: "loading" },
    settings: DEFAULT_SETTINGS,
    toast: null,
  };
}

type VybzContextValue = State & {
  me: User;
  /** Supabase id of the logged-in account (same as me.id). */
  userId: string;
  /** Email address of the logged-in account. */
  email: string;
  /** Your accepted friends. */
  friends: User[];
  getUser: (id: string) => User | undefined;
  /** Finds one of your circles (or a sample circle mentioned by sample posts/polls). */
  getCircle: (id: string) => Circle | undefined;
  /** Reloads friends, requests, circles and invites from Supabase. */
  reloadSocial: () => Promise<void>;
  /**
   * Runs a Supabase change, then: on error shows it (and sends you to log in if
   * your session expired); on success shows `success` and reloads. Returns true on success.
   */
  runSocial: (change: Promise<Result>, success?: string) => Promise<boolean>;
  react: (postId: string, reaction: ReactionKey) => void;
  addPost: (post: Post) => void;
  vote: (pollId: string, optionId: string) => void;
  addPoll: (poll: Poll) => void;
  closePoll: (pollId: string) => void;
  updateProfile: (changes: Extract<Action, { type: "updateProfile" }>["changes"]) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  showToast: (message: string, tone?: ToastTone) => void;
};

const VybzContext = createContext<VybzContextValue | null>(null);

const REDUCE_MOTION_KEY = "vybz:reduce-motion";

export function VybzProvider({ me, email, children }: { me: User; email: string; children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, { me }, initialState);
  const userId = me.id;

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => dispatch({ type: "toast", message, tone }),
    [],
  );

  const reloadSocial = useCallback(async () => {
    const result = await fetchSocial(userId);
    if (result.data) {
      dispatch({ type: "socialLoaded", data: result.data });
    } else {
      dispatch({ type: "socialFailed", error: result.error ?? "Couldn't load your circles." });
      if (result.expired) router.push("/login");
    }
  }, [userId, router]);

  const runSocial = useCallback(
    async (change: Promise<Result>, success?: string) => {
      const result = await change;
      if (result.error) {
        showToast(result.error, "error");
        if (result.expired) router.push("/login");
        return false;
      }
      if (success) showToast(success);
      await reloadSocial();
      return true;
    },
    [reloadSocial, router, showToast],
  );

  // Load friends and circles once when the app opens. Screens that need fresh
  // data (Circles, Friends) also call reloadSocial when they open.
  useEffect(() => {
    void reloadSocial();
  }, [reloadSocial]);

  // Auto-hide the toast after a few seconds.
  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const timer = setTimeout(() => dispatch({ type: "dismissToast", id }), 3200);
    return () => clearTimeout(timer);
  }, [state.toast]);

  // Restore "Reduce motion" saved on this device. Storage can be blocked
  // (e.g. private browsing), so failures are ignored.
  useEffect(() => {
    try {
      if (localStorage.getItem(REDUCE_MOTION_KEY) === "1") {
        dispatch({ type: "updateSettings", changes: { reduceMotion: true } });
      }
    } catch {}
  }, []);

  // Apply the "Reduce motion" preference to the whole page and remember it.
  useEffect(() => {
    document.documentElement.dataset.motion = state.settings.reduceMotion ? "reduce" : "full";
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, state.settings.reduceMotion ? "1" : "0");
    } catch {}
  }, [state.settings.reduceMotion]);

  const getUser = useCallback((id: string) => state.users.find((user) => user.id === id), [state.users]);
  const getCircle = useCallback(
    (id: string) =>
      state.circles.find((circle) => circle.id === id) ?? state.sampleCircles.find((circle) => circle.id === id),
    [state.circles, state.sampleCircles],
  );

  const value = useMemo<VybzContextValue>(() => {
    return {
      ...state,
      me: state.users.find((user) => user.id === userId) ?? me,
      userId,
      email,
      friends: state.friendIds.map((id) => state.users.find((user) => user.id === id)).filter((u): u is User => Boolean(u)),
      getUser,
      getCircle,
      reloadSocial,
      runSocial,
      react: (postId, reaction) => dispatch({ type: "react", postId, reaction }),
      addPost: (post) => dispatch({ type: "addPost", post }),
      vote: (pollId, optionId) => dispatch({ type: "vote", pollId, optionId }),
      addPoll: (poll) => dispatch({ type: "addPoll", poll }),
      closePoll: (pollId) => dispatch({ type: "closePoll", pollId }),
      updateProfile: (changes) => dispatch({ type: "updateProfile", userId, changes }),
      updateSettings: (changes) => dispatch({ type: "updateSettings", changes }),
      showToast,
    };
  }, [state, me, userId, email, getUser, getCircle, reloadSocial, runSocial, showToast]);

  return <VybzContext.Provider value={value}>{children}</VybzContext.Provider>;
}

export function useVybz() {
  const context = useContext(VybzContext);
  if (!context) throw new Error("useVybz must be used inside <VybzProvider>");
  return context;
}
