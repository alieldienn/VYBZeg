"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { CIRCLE_EMOJIS, LIMITS, THEME_GRADIENTS, THEME_LABELS } from "@/lib/constants";
import { createCircle } from "@/lib/social";
import { useVybz } from "@/lib/store";
import type { ThemeColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FriendPicker } from "./FriendPicker";

const COLORS = Object.keys(THEME_GRADIENTS) as ThemeColor[];
const DESCRIPTION_MAX = 120;

export function NewCircleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { friends, reloadSocial, showToast } = useVybz();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState(CIRCLE_EMOJIS[0]);
  const [color, setColor] = useState<ThemeColor>("violet");
  const [invited, setInvited] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length >= 2 && !saving;

  async function create() {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    const result = await createCircle({ name, description, emoji, color, inviteeIds: invited });
    if (result.error || !result.id) {
      setSaving(false);
      setError(result.error ?? "We couldn't create your circle. Please try again.");
      if (result.expired) router.push("/login");
      return;
    }
    await reloadSocial();
    showToast(result.warning ?? `${emoji} ${name.trim()} created`, result.warning ? "error" : "success");
    setName("");
    setDescription("");
    setInvited([]);
    setSaving(false);
    onClose();
    router.push(`/circles/${result.id}`);
  }

  return (
    <Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title="New circle"
      description="A private space for your closest people. Only people you invite can join."
      footer={
        <Button size="lg" className="w-full" onClick={create} disabled={!canCreate} aria-busy={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {saving ? "Creating…" : name.trim().length >= 2 ? "Create circle" : "Give it a name"}
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

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

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>
              Description <span className="font-normal text-subtle">(optional)</span>
            </span>
            <span className="text-xs font-normal text-subtle">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
            placeholder="What's this circle about?"
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
          <FriendPicker friends={friends} selected={invited} onChange={setInvited} />
        </div>
      </div>
    </Sheet>
  );
}
