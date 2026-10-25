"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { usePosts } from "@/lib/hooks/usePosts";
import { useVybz } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PostCard } from "./PostCard";

const ALL = "all";
const FRIENDS = "friends";

/** The Home feed: vibes from all your circles and friends, with chips to show just friends or one circle. */
export function Feed() {
  const { circles, friends, social } = useVybz();
  const [filter, setFilter] = useState<string>(ALL);

  if (social.status === "ready" && circles.length === 0 && friends.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-12 text-center">
        <p className="font-display text-lg font-semibold">Your feed is your people</p>
        <p className="mt-1 text-sm text-muted">
          Add friends to see what they share with all their friends, or start a circle with your closest people.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/circles" className={buttonStyles()}>
            Go to circles
          </Link>
          <Link href="/friends" className={buttonStyles({ variant: "secondary" })}>
            Add friends
          </Link>
        </div>
      </div>
    );
  }

  const chips = [
    { id: ALL, label: "Everything" },
    { id: FRIENDS, label: "👥 Friends" },
    ...circles.map((circle) => ({ id: circle.id, label: `${circle.emoji} ${circle.name}` })),
  ];

  return (
    <section aria-label="Feed">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            aria-pressed={filter === chip.id}
            className={cn(
              "h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-all",
              filter === chip.id
                ? "border-transparent bg-fg text-canvas"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {/* A new list (and fresh loading state) for each filter. */}
      <FeedList key={filter} filter={filter} />
    </section>
  );
}

function FeedList({ filter }: { filter: string }) {
  const circleId = filter === ALL || filter === FRIENDS ? undefined : filter;
  const feed = usePosts({ circleId, friendsOnly: filter === FRIENDS });

  if (feed.status === "loading") {
    return (
      <div className="mt-4 space-y-4" role="status" aria-label="Loading vibes">
        {[0, 1].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-[28px] bg-surface" />
        ))}
      </div>
    );
  }

  if (feed.status === "error") {
    return (
      <div className="mt-4 rounded-[28px] border border-danger/30 bg-danger/[0.06] px-6 py-10 text-center" role="alert">
        <p className="font-display text-lg font-semibold">Couldn&apos;t load vibes</p>
        <p className="mt-1 text-sm text-muted">{feed.error}</p>
        <Button variant="secondary" className="mt-5" onClick={feed.retry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {feed.posts.map((post) => (
        <PostCard key={post.id} post={post} onChange={feed.updatePost} onRemove={feed.removePost} className="animate-fade-up" />
      ))}
      {feed.posts.length === 0 && (
        <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold">Quiet in here…</p>
          <p className="mt-1 text-sm text-muted">No vibes yet. Be the first one.</p>
          <Link href={circleId ? `/post?circle=${circleId}` : "/post"} className={buttonStyles({ className: "mt-5" })}>
            Post a vibe
          </Link>
        </div>
      )}
      {feed.hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={feed.loadMore} disabled={feed.loadingMore}>
            {feed.loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Load more
          </Button>
        </div>
      )}
      {!feed.hasMore && feed.posts.length > 0 && (
        <p className="py-4 text-center text-xs text-subtle">You&apos;re all caught up ✨</p>
      )}
    </div>
  );
}
