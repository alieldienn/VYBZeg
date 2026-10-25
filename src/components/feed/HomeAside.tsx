"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PLAN_CATEGORIES } from "@/lib/constants";
import { usePolls } from "@/lib/hooks/usePolls";
import { useVybz } from "@/lib/store";
import { leadingOption, optionVotes, totalVotes } from "@/lib/utils";

/** Desktop-only right column on Home: open plans and circles at a glance. */
export function HomeAside() {
  const { circles, social, getCircle } = useVybz();
  const plans = usePolls();
  const openPolls = plans.polls.filter((poll) => poll.status === "open").slice(0, 3);

  return (
    <aside className="sticky top-8 hidden space-y-5 self-start xl:block">
      <section className="rounded-[28px] border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Plans brewing</h2>
          <Link href="/plans" className="text-xs font-medium text-brand-soft hover:underline">
            See all
          </Link>
        </div>
        {plans.status === "loading" && <div className="mt-3 h-24 animate-pulse rounded-2xl bg-elevated" role="status" aria-label="Loading plans" />}
        {plans.status === "error" && <p className="mt-3 text-sm text-muted">{plans.error}</p>}
        {plans.status === "ready" && openPolls.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Nothing to vote on.{" "}
            <Link href="/plans" className="font-medium text-brand-soft hover:underline">
              Make a plan
            </Link>{" "}
            and get the group moving.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {openPolls.map((poll) => {
            const leader = leadingOption(poll);
            const circle = getCircle(poll.circleId);
            const total = totalVotes(poll);
            return (
              <li key={poll.id}>
                <Link href="/plans" className="block rounded-2xl bg-elevated p-3 transition hover:bg-raised">
                  <p className="text-xs text-muted">
                    {[circle && `${circle.emoji} ${circle.name}`, poll.whenLabel].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug wrap-anywhere">{poll.question}</p>
                  <p className="mt-2 text-xs text-muted">
                    {total > 0
                      ? `Leading: ${PLAN_CATEGORIES[leader.category].emoji} ${leader.label} · ${Math.round((optionVotes(poll, leader) / total) * 100)}%`
                      : `No votes yet · ${poll.deadlineLabel.toLowerCase()}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[28px] border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Your circles</h2>
          <Link href="/circles" className="text-xs font-medium text-brand-soft hover:underline">
            See all
          </Link>
        </div>
        {social.status === "loading" && <div className="mt-3 h-24 animate-pulse rounded-2xl bg-elevated" role="status" aria-label="Loading circles" />}
        {social.status !== "loading" && circles.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            No circles yet.{" "}
            <Link href="/circles" className="font-medium text-brand-soft hover:underline">
              Start one
            </Link>{" "}
            or wait for an invite.
          </p>
        )}
        <ul className="mt-2">
          {circles.slice(0, 4).map((circle) => (
            <li key={circle.id}>
              <Link
                href={`/circles/${circle.id}`}
                className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-tint/[0.04]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated text-lg" aria-hidden>
                  {circle.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{circle.name}</span>
                  <span className="block text-xs text-muted">
                    {circle.newToday > 0 ? `${circle.newToday} new today` : `${circle.memberIds.length} members`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
