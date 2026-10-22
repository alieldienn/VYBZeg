"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { useVybz } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PostCard } from "./PostCard";

const ALL = "all";
const FRIENDS = "friends";

/** The list of friends' posts, with chips to filter by circle. */
export function Feed() {
  const { posts, circles } = useVybz();
  const [filter, setFilter] = useState<string>(ALL);

  const visible = posts.filter((post) => {
    if (filter === ALL) return true;
    if (filter === FRIENDS) return post.circleId === null;
    return post.circleId === filter;
  });

  const chips = [
    { id: ALL, label: "Everyone" },
    { id: FRIENDS, label: "Friends" },
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

      <div className="mt-4 space-y-4">
        {visible.map((post) => (
          <PostCard key={post.id} post={post} className="animate-fade-up" />
        ))}
        {visible.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold">Quiet in here…</p>
            <p className="mt-1 text-sm text-muted">No posts in this circle yet. Be the first one.</p>
            <Link href="/post" className={buttonStyles({ className: "mt-5" })}>
              Post a vibe
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
