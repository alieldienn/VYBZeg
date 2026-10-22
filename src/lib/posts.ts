/*
 * Posts, reactions, comments and daily prompts: Supabase calls from the browser.
 *
 * Every call runs as the logged-in user, so Row Level Security decides what
 * is visible: you only ever get posts (and photos, reactions, comments) from
 * circles you're a member of. Post photos live in the PRIVATE `post-images`
 * bucket and are shown through signed links that expire after an hour.
 */
import { cairoDay, daysAgoIso, streakFrom } from "@/lib/dates";
import { prepareImage } from "@/lib/images";
import { profileToUser } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/client";
import { failure, type Result } from "@/lib/supabase/errors";
import type { Comment, Post, Prompt, ReactionKey, ThemeColor, User } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const POST_IMAGES = "post-images";
/** How long a signed photo link works. The screens reload posts when reopened. */
const SIGNED_URL_SECONDS = 60 * 60;
const AUTHOR_COLUMNS = "id, username, display_name, avatar_path, avatar_hue";

const POST_SELECT = `id, author_id, circle_id, content, image_path, prompt_id, background, location, created_at,
  author:profiles!posts_author_id_fkey(${AUTHOR_COLUMNS}),
  prompt:daily_prompts(emoji, prompt_text),
  reactions(user_id, reaction_type),
  comments(count)`;

const NO_REACTIONS: Record<ReactionKey, number> = { fire: 0, lol: 0, love: 0, care: 0, wow: 0 };

// ------------------------------------------------------------------- posts ---

export type PostPage = { posts: Post[]; users: User[]; hasMore: boolean };

/**
 * Newest posts first. Without filters: every circle you're in (the Home feed).
 * `before` loads the next page (posts older than that time).
 */
export async function fetchPosts(
  userId: string,
  { circleId, authorId, before, limit = 20 }: { circleId?: string; authorId?: string; before?: string; limit?: number } = {},
): Promise<Result<{ page?: PostPage }>> {
  const supabase = createClient();
  let query = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(limit);
  if (circleId) query = query.eq("circle_id", circleId);
  if (authorId) query = query.eq("author_id", authorId);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return failure(error, "We couldn't load the vibes.");
  const rows = data ?? [];

  // One request signs every photo link on this page.
  const paths = rows.map((row) => row.image_path).filter((path): path is string => Boolean(path));
  const signed = new Map<string, string>();
  if (paths.length) {
    const urls = await supabase.storage.from(POST_IMAGES).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const item of urls.data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  const users = new Map<string, User>();
  const posts = rows.map((row): Post => {
    if (row.author) users.set(row.author.id, profileToUser(row.author));
    const reactions = { ...NO_REACTIONS };
    let myReaction: ReactionKey | null = null;
    for (const reaction of row.reactions ?? []) {
      if (reaction.user_id === userId) myReaction = reaction.reaction_type;
      else reactions[reaction.reaction_type] += 1;
    }
    return {
      id: row.id,
      authorId: row.author_id,
      circleId: row.circle_id,
      promptId: row.prompt_id,
      prompt: row.prompt ? { emoji: row.prompt.emoji, text: row.prompt.prompt_text } : undefined,
      kind: row.image_path ? "photo" : "text",
      imagePath: row.image_path ?? undefined,
      imageUrl: row.image_path ? signed.get(row.image_path) : undefined,
      text: row.content ?? "",
      background: (row.background as ThemeColor | null) ?? undefined,
      location: row.location ?? undefined,
      createdAt: row.created_at,
      timeLabel: timeAgo(row.created_at),
      reactions,
      myReaction,
      commentCount: row.comments?.[0]?.count ?? 0,
    };
  });

  return { page: { posts, users: [...users.values()], hasMore: rows.length === limit } };
}

export type NewPost = {
  userId: string;
  circleId: string;
  /** A photo from the device, for photo posts. */
  photo?: File;
  text: string;
  background?: ThemeColor;
  promptId: string | null;
  location: string;
};

/** Uploads the photo (if any) to private storage, then saves the post. */
export async function createPost(input: NewPost): Promise<Result<{ id?: string }>> {
  const supabase = createClient();
  let imagePath: string | null = null;

  if (input.photo) {
    let blob: Blob;
    try {
      blob = await prepareImage(input.photo, { maxSide: 1600 });
    } catch (error) {
      return { error: (error as Error).message };
    }
    // Folder layout <circle>/<you>/<random>.jpg is what the storage rules check.
    imagePath = `${input.circleId}/${input.userId}/${crypto.randomUUID()}.jpg`;
    const upload = await supabase.storage
      .from(POST_IMAGES)
      .upload(imagePath, blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (upload.error) {
      return /row-level security|unauthorized|403/i.test(upload.error.message)
        ? { error: "You can only post in circles you're a member of." }
        : { error: "Your photo didn't upload. Check your connection and try again." };
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      circle_id: input.circleId,
      content: input.text.trim() || null,
      image_path: imagePath,
      prompt_id: input.promptId,
      background: imagePath ? null : (input.background ?? null),
      location: input.location.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an unused photo behind.
    if (imagePath) await supabase.storage.from(POST_IMAGES).remove([imagePath]);
    if (error.code === "42501") return { error: "You can only post in circles you're a member of." };
    return failure(error, "We couldn't post your vibe. Please try again.");
  }
  return { id: data.id };
}

/** Deletes a post (authors and circle admins), and its photo when it's yours. */
export async function deletePost(userId: string, post: Post): Promise<Result> {
  const supabase = createClient();
  const { error, count } = await supabase.from("posts").delete({ count: "exact" }).eq("id", post.id);
  if (error) return failure(error);
  if (!count) return { error: "You can't delete this vibe." };
  // Storage only lets you delete your own files; an admin removing someone
  // else's post leaves that (now unreachable) photo in storage.
  if (post.imagePath && post.authorId === userId) {
    await supabase.storage.from(POST_IMAGES).remove([post.imagePath]);
  }
  return {};
}

// --------------------------------------------------------------- reactions ---

/** Sets your reaction on a post: a new one, a different one, or none (`next = null`). */
export async function setReaction(postId: string, current: ReactionKey | null, next: ReactionKey | null): Promise<Result> {
  const supabase = createClient();
  // RLS limits these to your own reaction row.
  const { error } =
    next === null
      ? await supabase.from("reactions").delete().eq("post_id", postId)
      : current === null
        ? await supabase.from("reactions").insert({ post_id: postId, reaction_type: next })
        : await supabase.from("reactions").update({ reaction_type: next }).eq("post_id", postId);
  if (error?.code === "42501") return { error: "You can only react to vibes in your circles." };
  return error ? failure(error, "Your reaction didn't save. Please try again.") : {};
}

// ---------------------------------------------------------------- comments ---

export async function fetchComments(postId: string): Promise<Result<{ comments?: Comment[]; users?: User[] }>> {
  const { data, error } = await createClient()
    .from("comments")
    .select(`id, post_id, author_id, content, created_at, author:profiles!comments_author_id_fkey(${AUTHOR_COLUMNS})`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return failure(error, "We couldn't load the comments.");
  const users = (data ?? []).flatMap((row) => (row.author ? [profileToUser(row.author)] : []));
  const comments = (data ?? []).map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    text: row.content,
    createdAt: row.created_at,
  }));
  return { comments, users };
}

export async function addComment(postId: string, text: string): Promise<Result<{ comment?: Comment }>> {
  const content = text.trim();
  if (!content) return { error: "Write something first." };
  if (content.length > 300) return { error: "Comments can be up to 300 characters." };
  const { data, error } = await createClient()
    .from("comments")
    .insert({ post_id: postId, content })
    .select("id, post_id, author_id, content, created_at")
    .single();
  if (error?.code === "42501") return { error: "You can only comment on vibes in your circles." };
  if (error) return failure(error, "Your comment didn't send. Please try again.");
  return {
    comment: { id: data.id, postId: data.post_id, authorId: data.author_id, text: data.content, createdAt: data.created_at },
  };
}

export async function deleteComment(commentId: string): Promise<Result> {
  const { error, count } = await createClient().from("comments").delete({ count: "exact" }).eq("id", commentId);
  if (error) return failure(error);
  return count ? {} : { error: "You can't delete this comment." };
}

// ----------------------------------------------------- daily prompts/stats ---

/** The newest released prompts, today's first. (Future prompts are hidden by the database.) */
export async function fetchRecentPrompts(limit = 6): Promise<Result<{ prompts?: Prompt[] }>> {
  const { data, error } = await createClient()
    .from("daily_prompts")
    .select("id, emoji, prompt_text, active_date")
    .order("active_date", { ascending: false })
    .limit(limit);
  if (error) return failure(error, "We couldn't load today's prompt.");
  return {
    prompts: (data ?? []).map((row) => ({ id: row.id, emoji: row.emoji, text: row.prompt_text, activeDate: row.active_date })),
  };
}

export type DailyVibe = {
  prompt: Prompt | null;
  /** True when the prompt is today's (not a leftover from an earlier day). */
  isToday: boolean;
  /** Friends in your circles who answered (not you). */
  answeredBy: User[];
  postedToday: boolean;
  /** Days in a row you posted (Cairo time). */
  streak: number;
  /** How many vibes you've posted in total. */
  postCount: number;
};

export async function fetchDailyVibe(userId: string): Promise<Result<{ vibe?: DailyVibe }>> {
  const supabase = createClient();
  const [prompts, myRecent, myCount] = await Promise.all([
    fetchRecentPrompts(1),
    supabase.from("posts").select("created_at").eq("author_id", userId).gte("created_at", daysAgoIso(120)),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
  ]);
  if (prompts.error) return prompts;
  const listError = myRecent.error ?? myCount.error;
  if (listError) return failure(listError);

  const prompt = prompts.prompts?.[0] ?? null;
  let answeredBy: User[] = [];
  let postedToday = false;
  if (prompt) {
    const answers = await supabase
      .from("posts")
      .select(`author_id, author:profiles!posts_author_id_fkey(${AUTHOR_COLUMNS})`)
      .eq("prompt_id", prompt.id)
      .limit(500);
    if (answers.error) return failure(answers.error);
    const people = new Map<string, User>();
    for (const row of answers.data ?? []) {
      if (row.author_id === userId) postedToday = true;
      else if (row.author) people.set(row.author.id, profileToUser(row.author));
    }
    answeredBy = [...people.values()];
  }

  const today = cairoDay();
  return {
    vibe: {
      prompt,
      isToday: prompt?.activeDate === today,
      answeredBy,
      postedToday,
      streak: streakFrom((myRecent.data ?? []).map((row) => cairoDay(row.created_at)), today),
      postCount: myCount.count ?? 0,
    },
  };
}
