"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchPolls } from "@/lib/polls";
import { useVybz } from "@/lib/store";
import type { Poll } from "@/lib/types";

type PollList = { status: "loading" | "ready" | "error"; error?: string; polls: Poll[] };

/**
 * The plans for one screen: every circle you're in, or just one circle.
 * Loads when the screen opens, and whenever `pollsVersion` changes (someone
 * created, locked in or deleted a plan).
 */
export function usePolls({ circleId }: { circleId?: string } = {}) {
  const router = useRouter();
  const { userId, pollsVersion, mergeUsers, showToast } = useVybz();
  const [list, setList] = useState<PollList>({ status: "loading", polls: [] });

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof fetchPolls>>) => {
      if (!result.polls) {
        if (result.expired) {
          showToast(result.error ?? "Please log in again.", "error");
          router.push("/login");
        }
        // Keep showing what we had, if anything; otherwise show the error.
        setList((current) => (current.status === "ready" ? current : { ...current, status: "error", error: result.error }));
        return;
      }
      mergeUsers(result.users ?? []);
      setList({ status: "ready", polls: result.polls });
    },
    [mergeUsers, showToast, router],
  );

  // `cancelled` ignores answers that arrive after the screen changed.
  useEffect(() => {
    let cancelled = false;
    fetchPolls(userId, { circleId }).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, circleId, pollsVersion, apply]);

  return {
    ...list,
    retry: () => {
      setList((current) => ({ ...current, status: "loading" }));
      fetchPolls(userId, { circleId }).then(apply);
    },
    /** Replace one plan in the list (after voting). */
    updatePoll: (poll: Poll) =>
      setList((current) => ({ ...current, polls: current.polls.map((p) => (p.id === poll.id ? poll : p)) })),
  };
}
