"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Ban, ChevronRight, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { blockUser, report, REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/safety";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = "menu" | "report" | "block";

type SafetySheetProps = {
  open: boolean;
  onClose: () => void;
  /** The person this is about (the author, for posts, comments and messages). */
  user: User;
  /** A post, comment or chat message to report, with a short name for it ("this vibe"). */
  content?: { target: Exclude<ReportTarget, { kind: "user" }>; label: string };
  /** Called after you blocked them, so the screen can drop their content right away. */
  onBlocked?: (userId: string) => void;
};

/**
 * Report and block, for a person or something they posted.
 * Render it with a new `key` each time it opens, so it starts at the menu.
 */
export function SafetySheet({ open, onClose, user, content, onBlocked }: SafetySheetProps) {
  const router = useRouter();
  const { showToast, reloadSocial, postsChanged } = useVybz();
  const [step, setStep] = useState<Step>("menu");
  const [target, setTarget] = useState<ReportTarget>(content?.target ?? { kind: "user", userId: user.id });
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = user.name.split(" ")[0];
  const reportingContent = target.kind !== "user";

  function startReport(next: ReportTarget) {
    setTarget(next);
    setError(null);
    setStep("report");
  }

  /** Blocks them and refreshes what's on screen. Returns false if it failed. */
  async function block() {
    const result = await blockUser(user.id);
    if (result.error) {
      setError(result.error);
      if (result.expired) router.push("/login");
      return false;
    }
    onBlocked?.(user.id);
    postsChanged();
    void reloadSocial();
    return true;
  }

  async function sendReport() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const result = await report(target, reason, details);
    if (result.error) {
      setBusy(false);
      setError(result.error);
      if (result.expired) router.push("/login");
      return;
    }
    const blocked = alsoBlock ? await block() : false;
    setBusy(false);
    if (alsoBlock && !blocked) return; // The report went through; the error explains the block.
    showToast(blocked ? `Thanks for reporting. ${firstName} is blocked.` : "Thanks for reporting. We'll take a look.");
    onClose();
  }

  async function confirmBlock() {
    setBusy(true);
    setError(null);
    const ok = await block();
    setBusy(false);
    if (!ok) return;
    showToast(`${firstName} is blocked`);
    onClose();
  }

  const title = step === "report" ? `Report ${reportingContent ? (content?.label ?? "this") : user.name}` : step === "block" ? `Block ${user.name}?` : user.name;

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={
        step === "report"
          ? "Reports are private: they won't know it was you."
          : step === "block"
            ? undefined
            : `@${user.username}`
      }
      footer={
        step === "report" ? (
          <Button size="lg" variant="danger" className="w-full" onClick={sendReport} disabled={!reason || busy} aria-busy={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {reason ? "Send report" : "Pick a reason"}
          </Button>
        ) : step === "block" ? (
          <div className="flex gap-2">
            <Button size="lg" variant="secondary" className="flex-1" onClick={() => setStep("menu")} disabled={busy}>
              Back
            </Button>
            <Button size="lg" variant="danger" className="flex-1" onClick={confirmBlock} disabled={busy} aria-busy={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Block
            </Button>
          </div>
        ) : undefined
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {step === "menu" && (
        <ul className="space-y-2">
          {content && (
            <MenuItem icon={<Flag className="h-4 w-4" />} onClick={() => startReport(content.target)}>
              Report {content.label}
            </MenuItem>
          )}
          <MenuItem icon={<Flag className="h-4 w-4" />} onClick={() => startReport({ kind: "user", userId: user.id })}>
            Report {firstName}&apos;s account
          </MenuItem>
          <MenuItem icon={<Ban className="h-4 w-4" />} danger onClick={() => setStep("block")}>
            Block {firstName}
          </MenuItem>
        </ul>
      )}

      {step === "report" && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What&apos;s wrong?</legend>
            <div className="space-y-2">
              {REPORT_REASONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition",
                    reason === option.value ? "border-danger/50 bg-danger/[0.06]" : "border-line bg-elevated hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="mt-1 accent-danger"
                  />
                  <span className="text-sm">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {reason === "self_harm" && (
            <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm">
              If someone is in danger right now, don&apos;t wait for us: call your local emergency number (in Egypt, the
              ambulance is <span className="font-semibold">123</span>) or reach out to them and someone they trust.
            </p>
          )}

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>
                More details <span className="font-normal text-subtle">(optional)</span>
              </span>
              <span className="text-xs font-normal text-subtle">
                {details.length}/{REPORT_DETAILS_MAX}
              </span>
            </span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, REPORT_DETAILS_MAX))}
              rows={3}
              placeholder="Anything that helps us understand what happened"
              className="w-full resize-none rounded-2xl border border-line bg-elevated px-4 py-3 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-elevated p-3">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(event) => setAlsoBlock(event.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <span className="block font-medium">Also block {firstName}</span>
              <span className="block text-xs text-muted">You&apos;ll stop seeing each other&apos;s vibes, comments and messages.</span>
            </span>
          </label>
        </div>
      )}

      {step === "block" && (
        <ul className="space-y-2 text-sm text-muted">
          <li>• You&apos;ll stop being friends, and any requests or invites between you are cancelled.</li>
          <li>• You won&apos;t see each other&apos;s vibes, comments or circle chat messages.</li>
          <li>• They can&apos;t send you friend requests, circle invites or notifications.</li>
          <li>• If you share a circle, you both stay in it.</li>
          <li>• They aren&apos;t told. You can unblock them any time in Profile → Privacy.</li>
        </ul>
      )}
    </Sheet>
  );
}

function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3.5 text-left text-sm font-medium transition hover:border-line-strong",
          danger && "text-danger",
        )}
      >
        {icon}
        <span className="flex-1">{children}</span>
        <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
      </button>
    </li>
  );
}
