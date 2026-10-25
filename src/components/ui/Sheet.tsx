"use client";

import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * A pop-up panel: slides up from the bottom on phones, centred dialog on desktop.
 * Built on the native <dialog> element, which handles focus and the Escape key for us.
 */
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Next.js keeps pages alive in the background after you navigate away.
  // Close the sheet when its page is hidden, so an invisible modal can't block the app.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
        onCloseRef.current();
      }
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the dark backdrop (outside the panel) closes the sheet.
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="sheet-title"
      className={cn(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-[28px] border border-line bg-surface p-0 text-fg",
        "sm:m-auto sm:max-w-lg sm:rounded-[28px]",
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-sheet-up",
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-tint/15 sm:hidden" />
          <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 sm:px-6 sm:pt-6">
            <div>
              <h2 id="sheet-title" className="font-display text-xl font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 rounded-full p-2 text-muted transition hover:bg-tint/5 hover:text-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
          {footer && (
            <footer className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
