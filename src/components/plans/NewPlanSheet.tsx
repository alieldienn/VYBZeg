"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { LIMITS, PLAN_CATEGORIES, PLAN_SUGGESTIONS } from "@/lib/constants";
import { createPoll } from "@/lib/polls";
import { useVybz } from "@/lib/store";
import type { PlanCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftOption = { label: string; category: PlanCategory; detail?: string };

const WHEN_CHOICES = ["Tonight", "Tomorrow", "This weekend", "Next week"];

export function NewPlanSheet({
  open,
  onClose,
  defaultCircleId,
}: {
  open: boolean;
  onClose: () => void;
  defaultCircleId?: string;
}) {
  const router = useRouter();
  const { circles, social, showToast, pollsChanged } = useVybz();
  const [question, setQuestion] = useState("");
  const [pickedCircleId, setCircleId] = useState(defaultCircleId ?? "");
  const [when, setWhen] = useState(WHEN_CHOICES[2]);
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  // Circles load after the page opens, so fall back to the first one once they arrive.
  const circleId = circles.some((c) => c.id === pickedCircleId) ? pickedCircleId : (circles[0]?.id ?? "");
  const full = options.length >= LIMITS.maxPollOptions;
  const canCreate = question.trim().length > 0 && options.length >= 2 && Boolean(circleId) && !saving;

  function addOption(option: DraftOption) {
    if (full || options.some((o) => o.label.toLowerCase() === option.label.toLowerCase())) return;
    setOptions([...options, option]);
  }

  function addCustom() {
    const label = custom.trim();
    if (!label) return;
    addOption({ label, category: "outing" });
    setCustom("");
  }

  function reset() {
    setQuestion("");
    setOptions([]);
    setCustom("");
    setWhen(WHEN_CHOICES[2]);
  }

  async function create() {
    if (!canCreate) return;
    setSaving(true);
    const result = await createPoll({ circleId, question, whenLabel: when, options });
    setSaving(false);
    if (result.error) {
      showToast(result.error, "error");
      if (result.expired) router.push("/login");
      return;
    }
    showToast("Plan created. Voting is open for 24 hours!");
    pollsChanged();
    reset();
    onClose();
  }

  const noCircles = social.status === "ready" && circles.length === 0;

  return (
    <Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title="New plan"
      description="Ask your circle and let everyone vote."
      footer={
        <Button size="lg" className="w-full" disabled={!canCreate} onClick={create}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {saving
            ? "Creating…"
            : canCreate
              ? "Create plan"
              : !question.trim()
                ? "Add a question"
                : options.length < 2
                  ? "Add at least 2 options"
                  : "Pick a circle"}
        </Button>
      }
    >
      <div className="space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Question</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value.slice(0, LIMITS.pollQuestion))}
            placeholder="What are we doing this weekend?"
            className="h-12 w-full rounded-2xl border border-line bg-elevated px-4 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium">Circle</p>
          {noCircles ? (
            <p className="text-sm text-muted">
              Plans happen inside a circle.{" "}
              <Link href="/circles" className="font-medium text-brand-soft hover:underline">
                Start a circle
              </Link>{" "}
              first, or accept an invite.
            </p>
          ) : social.status === "loading" ? (
            <div className="h-9 w-40 animate-pulse rounded-full bg-elevated" role="status" aria-label="Loading circles" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {circles.map((circle) => (
                <Chip key={circle.id} active={circleId === circle.id} onClick={() => setCircleId(circle.id)}>
                  {circle.emoji} {circle.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">When</p>
          <div className="flex flex-wrap gap-2">
            {WHEN_CHOICES.map((choice) => (
              <Chip key={choice} active={when === choice} onClick={() => setWhen(choice)}>
                {choice}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center justify-between text-sm font-medium">
            Options
            <span className="text-xs font-normal text-subtle">
              {options.length}/{LIMITS.maxPollOptions}
            </span>
          </p>
          {options.length > 0 && (
            <ul className="mb-3 space-y-2">
              {options.map((option, index) => (
                <li key={option.label} className="flex items-center gap-3 rounded-2xl border border-line bg-elevated p-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-raised text-lg" aria-hidden>
                    {PLAN_CATEGORIES[option.category].emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    className="rounded-full p-1.5 text-subtle transition hover:bg-tint/5 hover:text-fg"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {PLAN_SUGGESTIONS.filter((s) => !options.some((o) => o.label === s.label)).map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                disabled={full}
                onClick={() => addOption(suggestion)}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-sm text-muted transition hover:border-brand/60 hover:text-fg disabled:opacity-40"
              >
                <span aria-hidden>{PLAN_CATEGORIES[suggestion.category].emoji}</span>
                {suggestion.label}
              </button>
            ))}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addCustom();
            }}
          >
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value.slice(0, LIMITS.pollOption))}
              placeholder="Or type your own idea…"
              disabled={full}
              className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-elevated px-4 text-sm placeholder:text-subtle focus:border-brand/60 focus:outline-none disabled:opacity-40"
            />
            <Button type="submit" variant="secondary" size="icon" disabled={full || !custom.trim()} aria-label="Add option">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all",
        active ? "border-brand/60 bg-brand/15 text-fg" : "border-line bg-elevated text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
