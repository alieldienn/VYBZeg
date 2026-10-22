"use client";

import { CheckCircle2 } from "lucide-react";
import { useVybz } from "@/lib/store";

/** Shows short confirmation messages, e.g. after posting or voting. */
export function Toaster() {
  const { toast } = useVybz();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8 lg:pl-64"
    >
      {toast && (
        <div
          key={toast.id}
          className="flex animate-fade-up items-center gap-2.5 rounded-2xl border border-line-strong bg-elevated/95 px-4 py-3 text-sm font-medium shadow-2xl shadow-black/50 backdrop-blur"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-soft" aria-hidden />
          {toast.message}
        </div>
      )}
    </div>
  );
}
