"use client";

import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

type ConfirmSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Runs when confirmed. Return false to keep the sheet open (e.g. on error). */
  onConfirm: () => Promise<boolean | void>;
  danger?: boolean;
};

/** "Are you sure?" pop-up for actions that can't be undone. */
export function ConfirmSheet({ open, onClose, title, description, confirmLabel, onConfirm, danger }: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      if ((await onConfirm()) !== false) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="lg" className="flex-1" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{description}</div>
    </Sheet>
  );
}
