"use client";

import { REACTIONS } from "@/lib/constants";
import { useVybz } from "@/lib/store";
import type { Post } from "@/lib/types";
import { cn, reactionCount } from "@/lib/utils";

/** Tap an emoji to react. Tap it again to remove your reaction. One reaction per post. */
export function ReactionBar({ post, interactive = true }: { post: Post; interactive?: boolean }) {
  const { react } = useVybz();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
      {REACTIONS.map(({ key, emoji, label }) => {
        const count = reactionCount(post, key);
        const mine = post.myReaction === key;
        return (
          <button
            key={key}
            type="button"
            disabled={!interactive}
            aria-pressed={mine}
            aria-label={`${label}: ${count}`}
            onClick={() => react(post.id, key)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-all duration-200",
              mine
                ? "border-brand/50 bg-brand/15 text-fg"
                : "border-line bg-white/[0.03] text-muted hover:border-line-strong hover:bg-white/[0.06] hover:text-fg",
              interactive ? "active:scale-95" : "cursor-default",
            )}
          >
            <span className={cn("text-base leading-none", mine && "animate-pop")}>{emoji}</span>
            {count > 0 && <span className="min-w-[1ch] tabular-nums text-xs font-semibold">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
