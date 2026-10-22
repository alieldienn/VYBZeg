import Image from "next/image";
import { useId } from "react";
import { cn } from "@/lib/utils";
import wordmark from "../../../public/brand/vybz-wordmark.png";

export const TAGLINE = "Real friends. More vibes.";

/** The VYBZ app icon: a white brush "V" with sparks on a purple tile. */
export function LogoMark({ className }: { className?: string }) {
  // Unique ids so several icons on one page don't share gradients.
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9568F9" />
          <stop offset="0.5" stopColor="#8450F6" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={`${id}-ink`} x1="35" y1="20" x2="55" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6F1FF" />
          <stop offset="1" stopColor="#D8C6FF" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${id}-tile)`} />
      <path
        fill={`url(#${id}-ink)`}
        d="M30 45.5C29 41.5 31.5 38.5 34.6 38.2C37.2 38 38.8 39.6 39.4 41.8L45.2 61.5L62.6 40.2C64.4 37.9 67.7 37.5 69.8 39.3C71.6 40.9 71.8 43.5 70.4 45.5L50.4 79.6C48.4 83 45.4 84.6 42.6 83.6C40.6 82.9 39.4 81.4 38.8 79.4Z"
      />
      <path
        fill="none"
        stroke={`url(#${id}-ink)`}
        strokeWidth="4.8"
        strokeLinecap="round"
        d="M44 27.5L48.6 34.6M55.2 17L55.2 26.6M66.6 22.8L62.6 31.2"
      />
    </svg>
  );
}

/** The hand-lettered VYBZ wordmark from the brand moodboard. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={wordmark}
      alt="VYBZ"
      priority={priority}
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
  );
}
