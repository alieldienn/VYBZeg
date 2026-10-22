"use client";

import { Check, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type FriendPickerProps = {
  friends: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Friends shown greyed out with a label, e.g. already invited. */
  disabled?: Record<string, string>;
};

/** Shown instead of the list when you have no friends yet. */
function NoFriendsYet() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
      <p>You can only invite friends, and you haven&apos;t added any yet.</p>
      <Link href="/friends" className="mt-2 inline-block font-semibold text-brand-soft hover:underline">
        Add friends by username
      </Link>
    </div>
  );
}

/** Searchable list of friends with checkboxes. */
export function FriendPicker({ friends, selected, onChange, disabled = {} }: FriendPickerProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = friends.filter(
    (friend) => !q || friend.name.toLowerCase().includes(q) || friend.username.toLowerCase().includes(q),
  );

  if (friends.length === 0) return <NoFriendsYet />;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div>
      <label className="flex items-center gap-2 rounded-2xl border border-line bg-elevated px-4 focus-within:border-brand/60">
        <Search className="h-4 w-4 text-subtle" aria-hidden />
        <span className="sr-only">Search friends</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search friends"
          className="h-11 w-full bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
        />
      </label>

      <ul className="mt-3 space-y-1">
        {matches.map((friend) => {
          const note = disabled[friend.id];
          const checked = selected.includes(friend.id);
          return (
            <li key={friend.id}>
              <button
                type="button"
                disabled={Boolean(note)}
                aria-pressed={checked}
                onClick={() => toggle(friend.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition",
                  note ? "opacity-50" : "hover:bg-white/[0.04]",
                )}
              >
                <Avatar user={friend} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{friend.name}</span>
                  <span className="block truncate text-xs text-muted">
                    @{friend.username}
                    {friend.area && ` · ${friend.area}`}
                  </span>
                </span>
                {note ? (
                  <span className="text-xs font-medium text-subtle">{note}</span>
                ) : (
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                      checked ? "border-brand bg-brand text-white" : "border-line-strong",
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {matches.length === 0 && <li className="py-6 text-center text-sm text-muted">No friends match “{query}”.</li>}
      </ul>
    </div>
  );
}
