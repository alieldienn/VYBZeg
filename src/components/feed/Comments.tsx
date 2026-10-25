"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Flag, Loader2, RefreshCw, Send, X } from "lucide-react";
import { SafetySheet } from "@/components/safety/SafetySheet";
import { Avatar } from "@/components/ui/Avatar";
import { addComment, deleteComment, fetchComments } from "@/lib/posts";
import { useVybz } from "@/lib/store";
import type { Comment, Post } from "@/lib/types";
import { agoText, timeAgo } from "@/lib/utils";

const COMMENT_MAX = 300;

/** The comments under a post. Only mounted while open, so it loads on demand. */
export function Comments({ post, onCountChange }: { post: Post; onCountChange: (count: number) => void }) {
  const router = useRouter();
  const { me, getUser, mergeUsers, showToast } = useVybz();
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; comments: Comment[]; error?: string }>({
    status: "loading",
    comments: [],
  });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The comment being reported (or whose author is being blocked).
  const [safetyFor, setSafetyFor] = useState<Comment | null>(null);
  const [safetyKey, setSafetyKey] = useState(0);
  const safetyAuthor = safetyFor ? getUser(safetyFor.authorId) : undefined;

  useEffect(() => {
    let cancelled = false;
    fetchComments(post.id).then((result) => {
      if (cancelled) return;
      if (result.comments) {
        mergeUsers(result.users ?? []);
        setState({ status: "ready", comments: result.comments });
      } else {
        setState({ status: "error", comments: [], error: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [post.id, mergeUsers, attempt]);

  function fail(result: { error?: string; expired?: boolean }) {
    showToast(result.error ?? "Something went wrong.", "error");
    if (result.expired) router.push("/login");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await addComment(post.id, text);
    setSending(false);
    if (!result.comment) return fail(result);
    const comments = [...state.comments, result.comment];
    setState({ status: "ready", comments });
    onCountChange(comments.length);
    setText("");
  }

  async function remove(comment: Comment) {
    setDeleting(comment.id);
    const result = await deleteComment(comment.id);
    setDeleting(null);
    if (result.error) return fail(result);
    const comments = state.comments.filter((c) => c.id !== comment.id);
    setState({ status: "ready", comments });
    onCountChange(comments.length);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {state.status === "loading" ? (
        <p className="flex items-center gap-2 py-2 text-xs text-muted" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading comments…
        </p>
      ) : state.status === "error" ? (
        <p className="flex items-center gap-2 py-2 text-xs text-danger" role="alert">
          {state.error}
          <button type="button" onClick={() => setAttempt(attempt + 1)} className="inline-flex items-center gap-1 font-medium underline">
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </p>
      ) : state.comments.length === 0 ? (
        <p className="py-1 text-xs text-muted">No comments yet. Say something nice.</p>
      ) : (
        <ul className="space-y-3" aria-label="Comments">
          {state.comments.map((comment) => {
            const author = getUser(comment.authorId);
            const canDelete = comment.authorId === me.id || post.authorId === me.id;
            return (
              <li key={comment.id} className="flex gap-2.5">
                {author ? (
                  <Avatar user={author} size="xs" className="mt-0.5" />
                ) : (
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-elevated" />
                )}
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <span className="font-semibold">{author?.name ?? "Former member"}</span>{" "}
                  <span className="whitespace-pre-line wrap-anywhere text-fg/90">{comment.text}</span>
                  <span className="block text-[11px] text-subtle">{agoText(timeAgo(comment.createdAt))}</span>
                </div>
                {author && comment.authorId !== me.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setSafetyKey((n) => n + 1);
                      setSafetyFor(comment);
                    }}
                    className="self-start rounded-full p-1 text-subtle transition hover:bg-tint/5 hover:text-fg"
                    aria-label={`Report or block ${author.name}`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(comment)}
                    disabled={deleting === comment.id}
                    className="self-start rounded-full p-1 text-subtle transition hover:bg-tint/5 hover:text-danger disabled:opacity-50"
                    aria-label="Delete comment"
                  >
                    {deleting === comment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={send} className="mt-3 flex items-center gap-2">
        <label htmlFor={`comment-${post.id}`} className="sr-only">
          Write a comment
        </label>
        <input
          id={`comment-${post.id}`}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, COMMENT_MAX))}
          placeholder="Add a comment…"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-elevated px-4 text-sm placeholder:text-subtle focus:border-brand/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-110 disabled:opacity-40"
          aria-label="Send comment"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {safetyAuthor && safetyFor && (
        <SafetySheet
          key={safetyKey}
          open
          onClose={() => setSafetyFor(null)}
          user={safetyAuthor}
          content={{ target: { kind: "comment", commentId: safetyFor.id }, label: "this comment" }}
          onBlocked={(userId) => {
            const comments = state.comments.filter((c) => c.authorId !== userId);
            setState({ status: "ready", comments });
            onCountChange(comments.length);
          }}
        />
      )}
    </div>
  );
}
