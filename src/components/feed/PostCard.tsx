"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageIcon, ImageOff, MapPin, MessageCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { THEME_GRADIENTS } from "@/lib/constants";
import { deletePost } from "@/lib/posts";
import { useVybz } from "@/lib/store";
import type { Post, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Comments } from "./Comments";
import { ReactionBar } from "./ReactionBar";

type PostCardProps = {
  post: Post;
  /** Pass the author directly (used by the composer preview). */
  author?: User;
  /** Previews show the post without working buttons. */
  preview?: boolean;
  /** Called with the updated post after a reaction or comment. */
  onChange?: (post: Post) => void;
  /** Called after the post was deleted. */
  onRemove?: (postId: string) => void;
  className?: string;
};

export function PostCard({ post, author, preview = false, onChange, onRemove, className }: PostCardProps) {
  const router = useRouter();
  const { me, getUser, getCircle, showToast, postsChanged } = useVybz();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const user = author ?? getUser(post.authorId);
  const circle = post.circleId ? getCircle(post.circleId) : undefined;
  const canDelete =
    !preview && (post.authorId === me.id || ["owner", "admin"].includes(circle?.roles?.[me.id] ?? ""));

  async function remove() {
    const result = await deletePost(me.id, post);
    if (result.error) {
      showToast(result.error, "error");
      if (result.expired) router.push("/login");
      return false;
    }
    showToast("Vibe deleted");
    onRemove?.(post.id);
    postsChanged();
    return true;
  }

  return (
    <article className={cn("rounded-[28px] border border-line bg-surface p-3 sm:p-4", className)}>
      <header className="flex items-center gap-3 px-1 pb-3">
        {user ? (
          <Avatar user={user} size="md" />
        ) : (
          <span className="h-10 w-10 shrink-0 rounded-full bg-elevated" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{user?.name ?? "Former member"}</p>
          <p className="truncate text-xs text-muted">
            {user && `@${user.username} · `}
            <time dateTime={post.createdAt}>{post.timeLabel}</time>
          </p>
        </div>
        {circle &&
          (preview ? (
            <span className="flex max-w-[45%] items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted">
              <span aria-hidden>{circle.emoji}</span>
              <span className="truncate">{circle.name}</span>
            </span>
          ) : (
            <Link
              href={`/circles/${circle.id}`}
              className="flex max-w-[45%] items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted transition hover:text-fg"
            >
              <span aria-hidden>{circle.emoji}</span>
              <span className="truncate">{circle.name}</span>
            </Link>
          ))}
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="-mr-1 rounded-full p-2 text-subtle transition hover:bg-white/5 hover:text-danger"
            aria-label="Delete this vibe"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {post.prompt && (
        <p className="mx-1 mb-3 flex items-center gap-1.5 text-xs font-medium text-brand-soft">
          <span aria-hidden>{post.prompt.emoji}</span>
          <span className="truncate">{post.prompt.text}</span>
        </p>
      )}

      {post.kind === "photo" && post.imageUrl ? (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-elevated">
          {/* Signed links are private and short-lived, so they're loaded directly
              (unoptimized) instead of being copied into Next.js's image cache. */}
          <Image
            src={post.imageUrl}
            alt={post.text || `Photo by ${user?.name ?? "a friend"}`}
            fill
            sizes="(min-width: 640px) 560px, 100vw"
            unoptimized
            className="object-cover"
          />
          {post.location && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              <MapPin className="h-3 w-3" aria-hidden />
              {post.location}
            </span>
          )}
        </div>
      ) : post.kind === "photo" && preview ? (
        // Composer preview before a photo is chosen.
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line-strong bg-elevated text-subtle">
          <ImageIcon className="h-8 w-8" aria-hidden />
          <span className="text-sm">Your photo will appear here</span>
        </div>
      ) : post.kind === "photo" ? (
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[22px] bg-elevated text-subtle">
          <ImageOff className="h-8 w-8" aria-hidden />
          <span className="text-sm">Photo unavailable right now. Try reloading the page.</span>
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

      {post.kind === "photo" && post.text && <p className="whitespace-pre-line break-words px-1 pt-3 text-[15px] leading-relaxed">{post.text}</p>}
      {post.kind === "text" && post.location && (
        <p className="flex items-center gap-1 px-1 pt-2 text-xs text-muted">
          <MapPin className="h-3 w-3" aria-hidden /> {post.location}
        </p>
      )}

      <footer className="px-1 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReactionBar post={post} interactive={!preview} onChange={onChange} />
          {!preview && (
            <button
              type="button"
              onClick={() => setCommentsOpen(!commentsOpen)}
              aria-expanded={commentsOpen}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition",
                commentsOpen ? "bg-elevated text-fg" : "text-muted hover:bg-white/5 hover:text-fg",
              )}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {post.commentCount > 0 ? post.commentCount : ""}
              <span className="sr-only">{post.commentCount === 1 ? "comment" : "comments"}</span>
            </button>
          )}
        </div>
        {commentsOpen && <Comments post={post} onCountChange={(commentCount) => onChange?.({ ...post, commentCount })} />}
      </footer>

      {canDelete && (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          danger
          title="Delete this vibe?"
          description="It will be removed for everyone in the circle, together with its reactions and comments. This can't be undone."
          confirmLabel="Delete"
          onConfirm={remove}
        />
      )}
    </article>
  );
}
