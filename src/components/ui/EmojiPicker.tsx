"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Quick picks. Any other emoji can be typed or pasted in the box below them. */
const COMMON_EMOJIS = [
  "🫶", "❤️", "🔥", "✨", "😂", "😎", "🥳", "🤝",
  "⚽", "🎾", "🏀", "🏋️", "🎮", "🎧", "🎬", "📚",
  "☕", "🍕", "🍔", "🌯", "🍿", "🧋", "🌊", "🏖️",
  "🌆", "🏕️", "🚗", "✈️", "🎂", "🎉", "💼", "🕌",
];

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** The first emoji in some text (an emoji can be several characters, like 👨‍👩‍👧), or null if there is none. */
export function firstEmoji(text: string) {
  const parts = segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : Array.from(text);
  return parts.find((part) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(part)) ?? null;
}

type EmojiPickerProps = {
  value: string;
  onChange: (emoji: string) => void;
  label: string;
  className?: string;
};

/** Pick one emoji: tap a common one, or type/paste any emoji from your keyboard. */
export function EmojiPicker({ value, onChange, label, className }: EmojiPickerProps) {
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const custom = !COMMON_EMOJIS.includes(value);

  function onType(text: string) {
    setTyped(text);
    if (!text.trim()) {
      setHint(null);
      return;
    }
    const emoji = firstEmoji(text);
    // The database allows up to 8 characters, which fits nearly every emoji.
    if (emoji && Array.from(emoji).length <= 8) {
      onChange(emoji);
      setHint(null);
    } else if (emoji) {
      setHint("That emoji is too long. Try a simpler one.");
    } else {
      setHint("Use your keyboard's emoji button, or paste one.");
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {custom && value && <EmojiButton emoji={value} active onClick={() => onChange(value)} />}
        {COMMON_EMOJIS.map((emoji) => (
          <EmojiButton key={emoji} emoji={emoji} active={value === emoji} onClick={() => onChange(emoji)} />
        ))}
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Any other emoji</span>
        <input
          value={typed}
          onChange={(event) => onType(event.target.value.slice(0, 24))}
          placeholder="Or type any emoji… 🦄"
          inputMode="text"
          className="h-11 w-full rounded-2xl border border-line bg-elevated px-4 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
        />
      </label>
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function EmojiButton({ emoji, active, onClick }: { emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={emoji}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition-all",
        active ? "border-brand bg-brand/15" : "border-line bg-elevated hover:border-line-strong",
      )}
    >
      {emoji}
    </button>
  );
}
