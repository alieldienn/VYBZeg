"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Flag, Loader2, MessagesSquare, RefreshCw, Send, Trash2 } from "lucide-react";
import { SafetySheet } from "@/components/safety/SafetySheet";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { deleteMessage, fetchMessages, MESSAGE_MAX, sendMessage, subscribeToMessages, type ChatMessage } from "@/lib/chat";
import { useVybz } from "@/lib/store";
import type { Circle } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatState = {
  status: "loading" | "ready" | "error";
  error?: string;
  messages: ChatMessage[];
  hasMore: boolean;
};

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Adds messages that aren't in the list yet, keeping it in time order. */
function merge(current: ChatMessage[], incoming: ChatMessage[]) {
  const known = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  if (!added.length) return current;
  return [...current, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The live group chat of a circle. Only its members can open it (the database checks too). */
export function CircleChat({ circle }: { circle: Circle }) {
  const router = useRouter();
  const { me, getUser, mergeUsers, showToast } = useVybz();
  const [chat, setChat] = useState<ChatState>({ status: "loading", messages: [], hasMore: false });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The message being reported (or whose sender is being blocked).
  const [safetyFor, setSafetyFor] = useState<ChatMessage | null>(null);
  const [safetyKey, setSafetyKey] = useState(0);
  const safetyAuthor = safetyFor ? getUser(safetyFor.authorId) : undefined;
  const list = useRef<HTMLDivElement>(null);
  // Stay at the bottom when new messages arrive, unless you scrolled up to read.
  const stickToBottom = useRef(true);

  const myRole = circle.roles?.[me.id];
  const isAdmin = myRole === "owner" || myRole === "admin";

  // Load the latest messages, then listen for new and deleted ones.
  useEffect(() => {
    let cancelled = false;
    fetchMessages(circle.id).then((result) => {
      if (cancelled) return;
      if (!result.messages) {
        setChat((current) => ({ ...current, status: "error", error: result.error }));
        if (result.expired) router.push("/login");
        return;
      }
      mergeUsers(result.users ?? []);
      stickToBottom.current = true;
      setChat((current) => ({
        status: "ready",
        // Keep anything that arrived live while the first page was loading.
        messages: merge(result.messages ?? [], current.messages),
        hasMore: Boolean(result.hasMore),
      }));
    });
    const stop = subscribeToMessages(circle.id, {
      onNew: (message) => setChat((current) => ({ ...current, messages: merge(current.messages, [message]) })),
      onDeleted: (id) => setChat((current) => ({ ...current, messages: current.messages.filter((m) => m.id !== id) })),
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [circle.id, attempt, mergeUsers, router]);

  useLayoutEffect(() => {
    const box = list.current;
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [chat.messages]);

  function onScroll() {
    const box = list.current;
    if (box) stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  }

  async function loadOlder() {
    const oldest = chat.messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const box = list.current;
    const fromBottom = box ? box.scrollHeight - box.scrollTop : 0;
    const result = await fetchMessages(circle.id, { before: oldest.createdAt });
    setLoadingOlder(false);
    if (!result.messages) {
      showToast(result.error ?? "Couldn't load older messages.", "error");
      return;
    }
    mergeUsers(result.users ?? []);
    stickToBottom.current = false;
    setChat((current) => ({ ...current, messages: merge(current.messages, result.messages ?? []), hasMore: Boolean(result.hasMore) }));
    // Keep the messages you were reading in place.
    requestAnimationFrame(() => {
      if (box) box.scrollTop = box.scrollHeight - fromBottom;
    });
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    const { message, error, expired } = await sendMessage(circle.id, draft);
    setSending(false);
    if (!message) {
      showToast(error ?? "Your message didn't send.", "error");
      if (expired) router.push("/login");
      return;
    }
    setDraft("");
    stickToBottom.current = true;
    setChat((current) => ({ ...current, messages: merge(current.messages, [message]) }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter starts a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  async function remove(message: ChatMessage) {
    const result = await deleteMessage(message.id);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    setSelected(null);
    setChat((current) => ({ ...current, messages: current.messages.filter((m) => m.id !== message.id) }));
  }

  return (
    <section aria-labelledby="circle-chat" className="flex flex-col rounded-[28px] border border-line bg-surface">
      <h2 id="circle-chat" className="flex items-center gap-2 px-5 pt-5 font-display text-lg font-semibold">
        <MessagesSquare className="h-4 w-4 text-brand-soft" aria-hidden />
        Chat
      </h2>

      <div
        ref={list}
        onScroll={onScroll}
        className="mt-3 h-[min(60vh,480px)] overflow-y-auto px-3 sm:px-4"
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${circle.name}`}
      >
        {chat.status === "loading" ? (
          <div className="flex h-full items-center justify-center" role="status" aria-label="Loading messages">
            <Loader2 className="h-6 w-6 animate-spin text-subtle" />
          </div>
        ) : chat.status === "error" ? (
          <div className="flex h-full flex-col items-center justify-center text-center" role="alert">
            <p className="text-sm text-muted">{chat.error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setChat({ status: "loading", messages: [], hasMore: false });
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-4xl" aria-hidden>
              💬
            </p>
            <p className="mt-2 font-semibold">No messages yet</p>
            <p className="mt-1 text-sm text-muted">Say hi to {circle.name}. Only members can read this chat.</p>
          </div>
        ) : (
          <ol className="space-y-1 pb-3">
            {chat.hasMore && (
              <li className="flex justify-center pb-2">
                <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Load older messages
                </Button>
              </li>
            )}
            {chat.messages.map((message, index) => {
              const previous = chat.messages[index - 1];
              const mine = message.authorId === me.id;
              const author = mine ? me : getUser(message.authorId);
              const newDay = !previous || day.format(new Date(previous.createdAt)) !== day.format(new Date(message.createdAt));
              // Messages from the same person within a few minutes are grouped.
              const grouped =
                !newDay &&
                previous?.authorId === message.authorId &&
                Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60 * 1000;
              const canDelete = mine || isAdmin;
              const open = selected === message.id;
              return (
                <li key={message.id}>
                  {newDay && (
                    <p className="py-2 text-center text-[11px] font-medium text-subtle">{day.format(new Date(message.createdAt))}</p>
                  )}
                  <div className={cn("flex items-end gap-2", mine && "flex-row-reverse", !grouped && "pt-2")}>
                    {!mine &&
                      (grouped ? (
                        <span className="w-8 shrink-0" aria-hidden />
                      ) : author ? (
                        <Avatar user={author} size="sm" />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-full bg-elevated" aria-hidden />
                      ))}
                    <div className={cn("flex min-w-0 max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                      {!mine && !grouped && (
                        <span className="mb-0.5 px-1 text-xs font-medium text-muted">{author?.name ?? "Former member"}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(open ? null : message.id)}
                        aria-expanded={open}
                        className={cn(
                          "whitespace-pre-line wrap-anywhere rounded-[20px] px-3.5 py-2 text-left text-[15px] leading-snug",
                          mine ? "bg-brand-gradient text-white" : "bg-elevated text-fg",
                        )}
                      >
                        {message.text}
                      </button>
                      {open && (
                        <span className="mt-1 flex items-center gap-2 px-1 text-[11px] text-subtle">
                          <time dateTime={message.createdAt}>{clock.format(new Date(message.createdAt))}</time>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => remove(message)}
                              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-tint/5 hover:text-danger"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden />
                              Delete
                            </button>
                          )}
                          {!mine && author && (
                            <button
                              type="button"
                              onClick={() => {
                                setSafetyKey((n) => n + 1);
                                setSafetyFor(message);
                              }}
                              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-tint/5 hover:text-fg"
                            >
                              <Flag className="h-3 w-3" aria-hidden />
                              Report
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor={`chat-input-${circle.id}`}>
          Message {circle.name}
        </label>
        <textarea
          id={`chat-input-${circle.id}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX))}
          onKeyDown={onKeyDown}
          placeholder={`Message ${circle.name}…`}
          rows={1}
          disabled={chat.status !== "ready"}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-2.5 text-[15px] [field-sizing:content] placeholder:text-subtle focus:border-brand/60 focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || sending || chat.status !== "ready"} aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {safetyFor && safetyAuthor && (
        <SafetySheet
          key={safetyKey}
          open
          onClose={() => setSafetyFor(null)}
          user={safetyAuthor}
          content={{ target: { kind: "message", messageId: safetyFor.id }, label: "this message" }}
          onBlocked={(userId) =>
            setChat((current) => ({ ...current, messages: current.messages.filter((m) => m.authorId !== userId) }))
          }
        />
      )}
    </section>
  );
}
