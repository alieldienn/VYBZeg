import type { Poll, PollOption, Post, ReactionKey } from "./types";

/** Joins class names, skipping empty values. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Creates a unique id. Only call this inside event handlers, never while rendering. */
export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function reactionCount(post: Post, key: ReactionKey) {
  return post.reactions[key] + (post.myReaction === key ? 1 : 0);
}

export function totalReactions(post: Post) {
  return Object.values(post.reactions).reduce((sum, n) => sum + n, 0) + (post.myReaction ? 1 : 0);
}

export function optionVotes(poll: Poll, option: PollOption) {
  return option.voterIds.length + (poll.myVote === option.id ? 1 : 0);
}

export function totalVotes(poll: Poll) {
  return poll.options.reduce((sum, option) => sum + optionVotes(poll, option), 0);
}

/** The option with the most votes (first one wins a tie). */
export function leadingOption(poll: Poll) {
  return poll.options.reduce((best, option) =>
    optionVotes(poll, option) > optionVotes(poll, best) ? option : best,
  );
}

export function pluralize(count: number, word: string, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}
