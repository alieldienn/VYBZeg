import { MoreHorizontal } from "lucide-react";
import type { User } from "@/lib/types";

/** The ⋯ button next to a person that opens Report and Block. */
export function SafetyButton({ user, onOpen }: { user: User; onOpen: (user: User) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(user)}
      className="rounded-full p-2 text-subtle transition hover:bg-tint/5 hover:text-fg"
      aria-label={`Report or block ${user.name}`}
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}
