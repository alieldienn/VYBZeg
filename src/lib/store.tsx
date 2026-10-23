"use client";

/*
 * App-wide state shared by every screen. Everything here comes from Supabase:
 *  - Your profile: loaded on the server; edits are saved to Supabase first.
 *  - Friends, friend requests, circles and circle invites: loaded from
 *    Supabase in the browser (Row Level Security decides what you can see) and
 *    reloaded after every change.
 *  - Posts and plans are not kept here: each screen loads its own list (see
 *    usePosts and usePolls). `postsVersion` / `pollsVersion` tell those lists
 *    to reload after something changes.
 *  - `users` remembers every profile seen so far, so any screen can show a name.
 *  - "Reduce motion" is remembered on this device (localStorage).
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { DEFAULT_SETTINGS } from "./constants";
import { fetchSocial, type SocialData } from "./social";
import type { Result } from "./supabase/errors";
import type { Circle, CircleInvite, FriendRequest, Settings, User } from "./types";

export type ToastTone = "success" | "error";

type Toast = { id: number; message: string; tone: ToastTone };

type State = {
  users: User[];
  /** Goes up by one whenever posts change, so lists know to reload. */
  postsVersion: number;
  /** Same for plans (polls and votes). */
  pollsVersion: number;
  circles: Circle[];
  friendIds: string[];
  requests: FriendRequest[];
  invites: CircleInvite[];
  /** Loading status of friends/circles from Supabase. */
  social: { status: "loading" | "ready" | "error"; error?: string };
  settings: Settings;
  toast: Toast | null;
};

type Action =
  | { type: "postsChanged" }
  | { type: "pollsChanged" }
  | { type: "mergeUsers"; users: User[] }
  | { type: "socialLoaded"; data: SocialData }
  | { type: "socialFailed"; error: string }
  | { type: "updateProfile"; userId: string; changes: Partial<Pick<User, "name" | "username" | "bio" | "area" | "avatarUrl">> }
  | { type: "updateSettings"; changes: Partial<Settings> }
  | { type: "toast"; message: string; tone: ToastTone }
  | { type: "dismissToast"; id: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "postsChanged":
      return { ...state, postsVersion: state.postsVersion + 1 };
    case "pollsChanged":
      return { ...state, pollsVersion: state.pollsVersion + 1 };
    case "mergeUsers": {
      if (!action.users.length) return state;
      // Newer copies replace older ones (profile edits are saved to Supabase first, so this is safe).
      const fresh = new Map(action.users.map((user) => [user.id, user]));
      const known = new Set(state.users.map((user) => user.id));
      return {
        ...state,
        users: [
          ...state.users.map((user) => fresh.get(user.id) ?? user),
          ...action.users.filter((user) => !known.has(user.id)),
        ],
      };
    }
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

/** Starting state: just your own profile until friends and circles load. */
function initialState({ me }: { me: User }): State {
  return {
    users: [me],
    postsVersion: 0,
    pollsVersion: 0,
    circles: [],
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
  /** Finds one of your circles. */
  getCircle: (id: string) => Circle | undefined;
  /** Reloads friends, requests, circles and invites from Supabase. */
  reloadSocial: () => Promise<void>;
  /**
   * Runs a Supabase change, then: on error shows it (and sends you to log in if
   * your session expired); on success shows `success` and reloads. Returns true on success.
   */
  runSocial: (change: Promise<Result>, success?: string) => Promise<boolean>;
  /** Tell every post list to reload (after posting or deleting). */
  postsChanged: () => void;
  /** Tell every plan list to reload (after creating, locking in or deleting a plan). */
  pollsChanged: () => void;
  /** Remember profiles that came back with posts, comments or plans. */
  mergeUsers: (users: User[]) => void;
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

  const postsChanged = useCallback(() => dispatch({ type: "postsChanged" }), []);
  const pollsChanged = useCallback(() => dispatch({ type: "pollsChanged" }), []);
  const mergeUsers = useCallback((users: User[]) => dispatch({ type: "mergeUsers", users }), []);

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
  const getCircle = useCallback((id: string) => state.circles.find((circle) => circle.id === id), [state.circles]);

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
      postsChanged,
      pollsChanged,
      mergeUsers,
      updateProfile: (changes) => dispatch({ type: "updateProfile", userId, changes }),
      updateSettings: (changes) => dispatch({ type: "updateSettings", changes }),
      showToast,
    };
  }, [state, me, userId, email, getUser, getCircle, reloadSocial, runSocial, showToast, postsChanged, pollsChanged, mergeUsers]);

  return <VybzContext.Provider value={value}>{children}</VybzContext.Provider>;
}

export function useVybz() {
  const context = useContext(VybzContext);
  if (!context) throw new Error("useVybz must be used inside <VybzProvider>");
  return context;
}
