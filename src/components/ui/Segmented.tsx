"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; icon?: ReactNode; disabled?: boolean };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

/** A pill-shaped "pick one" control (like tabs). */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-2xl border border-line bg-surface p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
              active ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg",
              option.disabled && "cursor-not-allowed opacity-40 hover:text-muted",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
