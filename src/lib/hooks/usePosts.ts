"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchDailyVibe, fetchPosts, type DailyVibe, type PostFilter } from "@/lib/posts";
import { useVybz } from "@/lib/store";
import type { Post } from "@/lib/types";

type PostList = {
  status: "loading" | "ready" | "error";
  error?: string;
  posts: Post[];
  hasMore: boolean;
  loadingMore: boolean;
};

/**
 * A list of posts for one screen: the Home feed (no filter), one circle,
 * "All friends" posts only, or one person. Loads when the screen opens or is
 * shown again, and whenever `postsVersion` changes (someone posted or deleted).
 */
export function usePosts({ circleId, friendsOnly, authorId }: PostFilter = {}) {
  const router = useRouter();
  const { userId, postsVersion, mergeUsers, showToast } = useVybz();
  const [list, setList] = useState<PostList>({ status: "loading", posts: [], hasMore: false, loadingMore: false });

  /** Puts a loaded page into the list (or handles the error). `before` = it was "load more". */
  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchPosts>>, before?: string) => {
      if (!result.page) {
        if (result.expired) {
          showToast(result.error ?? "Please log in again.", "error");
          router.push("/login");
        }
        if (before) {
          showToast(result.error ?? "Couldn't load more.", "error");
          setList((current) => ({ ...current, loadingMore: false }));
        } else {
          // Keep showing what we had, if anything; otherwise show the error.
          setList((current) =>
            current.status === "ready" ? current : { ...current, status: "error", error: result.error },
          );
        }
        return;
      }
      const page = result.page;
      mergeUsers(page.users);
      setList((current) => ({
        status: "ready",
        posts: before ? [...current.posts, ...page.posts.filter((p) => !current.posts.some((c) => c.id === p.id))] : page.posts,
        hasMore: page.hasMore,
        loadingMore: false,
      }));
    },
    [mergeUsers, showToast, router],
  );

  // Load the newest page. `cancelled` ignores answers that arrive after the
  // screen changed (e.g. you switched filters), so old data never overwrites new.
  useEffect(() => {
    let cancelled = false;
    fetchPosts(userId, { circleId, friendsOnly, authorId }).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, circleId, friendsOnly, authorId, postsVersion, apply]);

  return {
    ...list,
    retry: () => {
      setList((current) => ({ ...current, status: "loading" }));
      fetchPosts(userId, { circleId, friendsOnly, authorId }).then((result) => apply(result));
    },
    loadMore: () => {
      const oldest = list.posts.at(-1);
      if (!oldest || list.loadingMore) return;
      setList((current) => ({ ...current, loadingMore: true }));
      fetchPosts(userId, { circleId, friendsOnly, authorId, before: oldest.createdAt }).then((result) =>
        apply(result, oldest.createdAt),
      );
    },
    /** Replace one post in the list (after a reaction or comment). */
    updatePost: (post: Post) =>
      setList((current) => ({ ...current, posts: current.posts.map((p) => (p.id === post.id ? post : p)) })),
    /** Drop a deleted post from the list. */
    removePost: (postId: string) =>
      setList((current) => ({ ...current, posts: current.posts.filter((p) => p.id !== postId) })),
  };
}

/** Today's prompt, who answered, your streak and post count. Reloads when posts change. */
export function useDailyVibe() {
  const { userId, postsVersion, mergeUsers } = useVybz();
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; vibe?: DailyVibe; error?: string }>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    fetchDailyVibe(userId).then((result) => {
      if (cancelled) return;
      if (result.vibe) {
        mergeUsers(result.vibe.answeredBy);
        setState({ status: "ready", vibe: result.vibe });
      } else {
        setState((current) => (current.vibe ? current : { status: "error", error: result.error }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, postsVersion, mergeUsers]);

  return state;
}
