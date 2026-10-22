"use client";

/*
 * App-wide state for the demo.
 * Holds posts, circles, polls, profile and settings in memory so every
 * screen sees the same data. Nothing is saved: refreshing the page resets it.
 * In a later milestone these actions will call Supabase instead.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import {
  CURRENT_USER_ID,
  DEFAULT_SETTINGS,
  SAMPLE_CIRCLES,
  SAMPLE_POLLS,
  SAMPLE_POSTS,
  SAMPLE_USERS,
} from "./sample-data";
import type { Circle, Poll, Post, ReactionKey, Settings, User } from "./types";

type Toast = { id: number; message: string };

type State = {
  users: User[];
  posts: Post[];
  circles: Circle[];
  polls: Poll[];
  settings: Settings;
  toast: Toast | null;
};

type Action =
  | { type: "react"; postId: string; reaction: ReactionKey }
  | { type: "addPost"; post: Post }
  | { type: "vote"; pollId: string; optionId: string }
  | { type: "addPoll"; poll: Poll }
  | { type: "closePoll"; pollId: string }
  | { type: "addCircle"; circle: Circle }
  | { type: "invite"; circleId: string; userIds: string[] }
  | { type: "updateProfile"; changes: Partial<Pick<User, "name" | "username" | "bio" | "area" | "avatarUrl">> }
  | { type: "updateSettings"; changes: Partial<Settings> }
  | { type: "toast"; message: string }
  | { type: "dismissToast"; id: number };

const initialState: State = {
  users: SAMPLE_USERS,
  posts: SAMPLE_POSTS,
  circles: SAMPLE_CIRCLES,
  polls: SAMPLE_POLLS,
  settings: DEFAULT_SETTINGS,
  toast: null,
};

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
    case "addCircle":
      return { ...state, circles: [action.circle, ...state.circles] };
    case "invite":
      return {
        ...state,
        circles: state.circles.map((circle) =>
          circle.id === action.circleId
            ? { ...circle, invitedIds: Array.from(new Set([...circle.invitedIds, ...action.userIds])) }
            : circle,
        ),
      };
    case "updateProfile":
      return {
        ...state,
        users: state.users.map((user) => (user.id === CURRENT_USER_ID ? { ...user, ...action.changes } : user)),
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case "toast":
      return { ...state, toast: { id: (state.toast?.id ?? 0) + 1, message: action.message } };
    case "dismissToast":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
  }
}

type VybzContextValue = State & {
  me: User;
  getUser: (id: string) => User | undefined;
  getCircle: (id: string) => Circle | undefined;
  react: (postId: string, reaction: ReactionKey) => void;
  addPost: (post: Post) => void;
  vote: (pollId: string, optionId: string) => void;
  addPoll: (poll: Poll) => void;
  closePoll: (pollId: string) => void;
  addCircle: (circle: Circle) => void;
  invite: (circleId: string, userIds: string[]) => void;
  updateProfile: (changes: Extract<Action, { type: "updateProfile" }>["changes"]) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  showToast: (message: string) => void;
};

const VybzContext = createContext<VybzContextValue | null>(null);

export function VybzProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Auto-hide the toast after a few seconds.
  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const timer = setTimeout(() => dispatch({ type: "dismissToast", id }), 3200);
    return () => clearTimeout(timer);
  }, [state.toast]);

  // Apply the in-app "Reduce motion" preference to the whole page.
  useEffect(() => {
    document.documentElement.dataset.motion = state.settings.reduceMotion ? "reduce" : "full";
  }, [state.settings.reduceMotion]);

  const getUser = useCallback((id: string) => state.users.find((user) => user.id === id), [state.users]);
  const getCircle = useCallback((id: string) => state.circles.find((circle) => circle.id === id), [state.circles]);

  const value = useMemo<VybzContextValue>(
    () => ({
      ...state,
      me: state.users.find((user) => user.id === CURRENT_USER_ID)!,
      getUser,
      getCircle,
      react: (postId, reaction) => dispatch({ type: "react", postId, reaction }),
      addPost: (post) => dispatch({ type: "addPost", post }),
      vote: (pollId, optionId) => dispatch({ type: "vote", pollId, optionId }),
      addPoll: (poll) => dispatch({ type: "addPoll", poll }),
      closePoll: (pollId) => dispatch({ type: "closePoll", pollId }),
      addCircle: (circle) => dispatch({ type: "addCircle", circle }),
      invite: (circleId, userIds) => dispatch({ type: "invite", circleId, userIds }),
      updateProfile: (changes) => dispatch({ type: "updateProfile", changes }),
      updateSettings: (changes) => dispatch({ type: "updateSettings", changes }),
      showToast: (message) => dispatch({ type: "toast", message }),
    }),
    [state, getUser, getCircle],
  );

  return <VybzContext.Provider value={value}>{children}</VybzContext.Provider>;
}

export function useVybz() {
  const context = useContext(VybzContext);
  if (!context) throw new Error("useVybz must be used inside <VybzProvider>");
  return context;
}
