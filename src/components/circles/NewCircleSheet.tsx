"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { CIRCLE_EMOJIS, LIMITS, THEME_GRADIENTS, THEME_LABELS } from "@/lib/constants";
import { CURRENT_USER_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { ThemeColor } from "@/lib/types";
import { cn, newId } from "@/lib/utils";
import { FriendPicker } from "./FriendPicker";

const COLORS = Object.keys(THEME_GRADIENTS) as ThemeColor[];

export function NewCircleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { users, addCircle, showToast } = useVybz();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(CIRCLE_EMOJIS[0]);
  const [color, setColor] = useState<ThemeColor>("violet");
  const [invited, setInvited] = useState<string[]>([]);

  const canCreate = name.trim().length >= 2;

  function create() {
    if (!canCreate) return;
    const id = newId("c");
    addCircle({
      id,
      name: name.trim(),
      emoji,
      color,
      description: "A new circle. Say hi!",
      memberIds: [CURRENT_USER_ID],
      invitedIds: invited,
      activity: [{ id: newId("a"), userId: CURRENT_USER_ID, kind: "join", text: "created the circle", timeLabel: "now" }],
      streak: 0,
      newToday: 0,
    });
    showToast(`${emoji} ${name.trim()} created (demo)`);
    setName("");
    setInvited([]);
    onClose();
    router.push(`/circles/${id}`);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New circle"
      description="A private space for your closest people."
      footer={
        <Button size="lg" className="w-full" onClick={create} disabled={!canCreate}>
          {canCreate ? "Create circle" : "Give it a name"}
        </Button>
      }
    >
      <div className="space-y-6">
        <div className={cn("flex h-28 items-center justify-center rounded-3xl text-5xl transition-all", THEME_GRADIENTS[color])}>
          <span aria-hidden>{emoji}</span>
        </div>

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-medium">
            Name
            <span className="text-xs font-normal text-subtle">
              {name.length}/{LIMITS.circleName}
            </span>
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, LIMITS.circleName))}
            placeholder="e.g. Gym Rats, Cousins, Uni Gang"
            className="h-12 w-full rounded-2xl border border-line bg-elevated px-4 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium">Emoji</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Emoji">
            {CIRCLE_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={emoji === option}
                onClick={() => setEmoji(option)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition-all",
                  emoji === option ? "border-brand bg-brand/15" : "border-line bg-elevated hover:border-line-strong",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Colour</p>
          <div className="flex gap-2.5" role="radiogroup" aria-label="Colour">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={THEME_LABELS[option]}
                onClick={() => setColor(option)}
                className={cn(
                  "h-10 w-10 rounded-full transition-all",
                  THEME_GRADIENTS[option],
                  color === option ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100",
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            Invite friends <span className="font-normal text-subtle">(optional)</span>
          </p>
          <FriendPicker
            friends={users.filter((user) => user.id !== CURRENT_USER_ID)}
            selected={invited}
            onChange={setInvited}
          />
        </div>
      </div>
    </Sheet>
  );
}
