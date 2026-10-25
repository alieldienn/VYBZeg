/*
 * Circle chat: Supabase calls from the browser.
 *
 * Every call runs as the logged-in user, so Row Level Security decides what
 * is allowed: only members read or send a circle's messages, and only the
 * sender or a circle admin can delete one. New messages arrive live through
 * Supabase Realtime, which applies the same rules before sending them.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { profileToUser } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { User } from "@/lib/types";

export const MESSAGE_MAX = 1000;
const PERSON_COLUMNS = "id, username, display_name, avatar_path, avatar_hue";
const MESSAGE_COLUMNS = "id, circle_id, author_id, content, created_at";

export type ChatMessage = {
  id: string;
  circleId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

type MessageRow = { id: string; circle_id: string; author_id: string; content: string; created_at: string };

function toMessage(row: MessageRow): ChatMessage {
  return { id: row.id, circleId: row.circle_id, authorId: row.author_id, text: row.content, createdAt: row.created_at };
}

/**
 * The newest messages of a circle, oldest first (the order a chat shows them).
 * `before` loads older messages. Also returns the senders' profiles.
 */
export async function fetchMessages(
  circleId: string,
  { before, limit = 50 }: { before?: string; limit?: number } = {},
): Promise<Result<{ messages?: ChatMessage[]; users?: User[]; hasMore?: boolean }>> {
  let query = createClient()
    .from("circle_messages")
    .select(`${MESSAGE_COLUMNS}, author:profiles!circle_messages_author_id_fkey(${PERSON_COLUMNS})`)
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return failure(error, "We couldn't load the chat.");
  const rows = data ?? [];
  const users = rows.flatMap((row) => (row.author ? [profileToUser(row.author)] : []));
  return { messages: rows.map(toMessage).reverse(), users, hasMore: rows.length === limit };
}

export async function sendMessage(circleId: string, text: string): Promise<Result<{ message?: ChatMessage }>> {
  const content = text.trim();
  if (!content) return { error: "Write something first." };
  if (content.length > MESSAGE_MAX) return { error: `Messages can be up to ${MESSAGE_MAX} characters.` };
  const { data, error } = await createClient()
    .from("circle_messages")
    .insert({ circle_id: circleId, content })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error?.code === "42501") return { error: "You can only chat in circles you're a member of." };
  if (error) return failure(error, "Your message didn't send. Please try again.");
  return { message: toMessage(data) };
}

export async function deleteMessage(messageId: string): Promise<Result> {
  const { error, count } = await createClient().from("circle_messages").delete({ count: "exact" }).eq("id", messageId);
  if (error) return failure(error, "We couldn't delete the message.");
  return count ? {} : { error: "You can't delete this message." };
}

/**
 * Calls `onNew` for every message sent in the circle while the chat is open,
 * and `onDeleted` with the id of every deleted one. Returns a function that stops listening.
 */
export function subscribeToMessages(
  circleId: string,
  { onNew, onDeleted }: { onNew: (message: ChatMessage) => void; onDeleted: (messageId: string) => void },
) {
  const supabase = createClient();
  const channel: RealtimeChannel = supabase
    .channel(`circle-chat:${circleId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "circle_messages", filter: `circle_id=eq.${circleId}` },
      (payload) => onNew(toMessage(payload.new as MessageRow)),
    )
    // Deleted rows only carry their id, so they can't be filtered by circle:
    // the chat ignores ids it doesn't have.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "circle_messages" }, (payload) => {
      const id = (payload.old as { id?: string }).id;
      if (id) onDeleted(id);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
