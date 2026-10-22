"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useVybz } from "@/lib/store";

/** Shows short messages: confirmations (purple tick) and errors (red). */
export function Toaster() {
  const { toast } = useVybz();
  const isError = toast?.tone === "error";
  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8 lg:pl-64"
    >
      {toast && (
        <div
          key={toast.id}
          role={isError ? "alert" : "status"}
          className={
            "flex max-w-md animate-fade-up items-center gap-2.5 rounded-2xl border bg-elevated/95 px-4 py-3 text-sm font-medium shadow-2xl shadow-black/50 backdrop-blur " +
            (isError ? "border-danger/40" : "border-line-strong")
          }
        >
          {isError ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-soft" aria-hidden />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
