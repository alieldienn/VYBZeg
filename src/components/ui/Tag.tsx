import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A tiny label like "Beta", "Soon" or "You". */
export function Tag({ children, tone = "beta" }: { children: ReactNode; tone?: "beta" | "soon" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "beta" && "bg-warning/10 text-warning",
        tone === "soon" && "bg-white/5 text-subtle",
        tone === "brand" && "bg-brand/15 text-brand-soft",
      )}
    >
      {children}
    </span>
  );
}
