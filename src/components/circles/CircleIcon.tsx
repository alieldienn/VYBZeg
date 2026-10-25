import Image from "next/image";
import { cn } from "@/lib/utils";

type CircleIconProps = {
  emoji: string;
  imageUrl?: string;
  /** Box size for the photo, e.g. "h-14 w-14". */
  size: string;
  /** Text size for the emoji, e.g. "text-5xl". */
  emojiSize: string;
  className?: string;
};

/** A circle's icon: its cover photo when it has one, otherwise its emoji. */
export function CircleIcon({ emoji, imageUrl, size, emojiSize, className }: CircleIconProps) {
  if (imageUrl) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/40", size, className)}>
        <Image src={imageUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
      </span>
    );
  }
  return (
    <span className={cn("drop-shadow-lg", emojiSize, className)} aria-hidden>
      {emoji}
    </span>
  );
}
