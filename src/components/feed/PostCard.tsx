"use client";

import Image from "next/image";
import Link from "next/link";
import { Globe2, ImageIcon, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { THEME_GRADIENTS } from "@/lib/constants";
import { PROMPTS } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { Post, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReactionBar } from "./ReactionBar";

type PostCardProps = {
  post: Post;
  /** Pass the author directly (used by the composer preview). */
  author?: User;
  /** Previews show the post without working reaction buttons. */
  preview?: boolean;
  className?: string;
};

export function PostCard({ post, author, preview = false, className }: PostCardProps) {
  const { getUser, getCircle } = useVybz();
  const user = author ?? getUser(post.authorId);
  const circle = post.circleId ? getCircle(post.circleId) : undefined;
  const prompt = post.promptId ? PROMPTS.find((p) => p.id === post.promptId) : undefined;
  if (!user) return null;

  return (
    <article className={cn("rounded-[28px] border border-line bg-surface p-3 sm:p-4", className)}>
      <header className="flex items-center gap-3 px-1 pb-3">
        <Avatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-xs text-muted">
            @{user.username} · {post.timeLabel}
          </p>
        </div>
        {circle && circle.sample ? (
          // Sample circles from the demo data have no page to open.
          <span className="flex max-w-[45%] items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted">
            <span aria-hidden>{circle.emoji}</span>
            <span className="truncate">{circle.name}</span>
          </span>
        ) : circle ? (
          <Link
            href={`/circles/${circle.id}`}
            className="flex max-w-[45%] items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted transition hover:text-fg"
          >
            <span aria-hidden>{circle.emoji}</span>
            <span className="truncate">{circle.name}</span>
          </Link>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted">
            <Globe2 className="h-3 w-3" aria-hidden />
            Friends
          </span>
        )}
      </header>

      {prompt && (
        <p className="mx-1 mb-3 flex items-center gap-1.5 text-xs font-medium text-brand-soft">
          <span aria-hidden>{prompt.emoji}</span>
          <span className="truncate">{prompt.text}</span>
        </p>
      )}

      {post.kind === "photo" && post.imageUrl ? (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-elevated">
          <Image
            src={post.imageUrl}
            alt={post.text || `Photo by ${user.name}`}
            fill
            sizes="(min-width: 640px) 560px, 100vw"
            unoptimized={post.imageUrl.startsWith("blob:")}
            className="object-cover"
          />
          {post.location && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              <MapPin className="h-3 w-3" aria-hidden />
              {post.location}
            </span>
          )}
        </div>
      ) : post.kind === "photo" ? (
        // Composer preview before a photo is chosen.
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-strong bg-elevated text-subtle">
          <ImageIcon className="h-8 w-8" aria-hidden />
          <span className="text-sm">Your photo will appear here</span>
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-52 items-center rounded-[22px] p-6 sm:min-h-60 sm:p-8",
            THEME_GRADIENTS[post.background ?? "violet"],
            post.background === "lime" ? "text-emerald-950" : "text-white",
          )}
        >
          <p className="whitespace-pre-line break-words font-display text-2xl font-semibold leading-snug sm:text-[28px]">
            {post.text || <span className="opacity-60">Your text will appear here…</span>}
          </p>
        </div>
      )}

      {post.kind === "photo" && post.text && <p className="px-1 pt-3 text-[15px] leading-relaxed">{post.text}</p>}

      <footer className="px-1 pt-3">
        <ReactionBar post={post} interactive={!preview} />
      </footer>
    </article>
  );
}
