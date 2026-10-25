"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Bell, Camera, Check, ChevronRight, Flame, Globe2, Loader2, LogOut, MapPin, Palette, PenLine, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { InstallRow } from "@/components/pwa/Install";
import { PushSettings } from "./PushSettings";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ComingSoon } from "@/components/ui/Tag";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { signOut } from "@/lib/auth/actions";
import { THEME_GRADIENTS } from "@/lib/constants";
import { setAvatar } from "@/lib/profile/actions";
import { useDailyVibe, usePosts } from "@/lib/hooks/usePosts";
import { IMAGE_ACCEPT } from "@/lib/images";
import { forgetThisDevice } from "@/lib/push";
import { useVybz } from "@/lib/store";
import { setTheme, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { deleteAvatar, uploadAvatar } from "@/lib/supabase/uploads";
import { cn } from "@/lib/utils";
import { EditProfileSheet } from "./EditProfileSheet";

export function ProfileView() {
  const router = useRouter();
  const { me, userId, email, circles, friendIds, requests, social, settings, updateSettings, updateProfile, showToast } =
    useVybz();
  const [editing, setEditing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const myPosts = usePosts({ authorId: me.id });
  const { vibe } = useDailyVibe();
  const myCircles = circles.filter((circle) => circle.memberIds.includes(me.id));
  const socialReady = social.status === "ready";
  const incoming = requests.filter((r) => r.direction === "incoming").length;

  async function applyAvatar(newPath: string | null) {
    const result = await setAvatar(newPath);
    if (result.error) {
      if (newPath) await deleteAvatar(newPath); // Don't leave the unused upload behind.
      showToast(result.error, "error");
      if (result.expired) router.push("/login");
      return;
    }
    updateProfile({ avatarUrl: result.avatarUrl ?? undefined });
    showToast(newPath ? "Profile photo updated" : "Profile photo removed");
  }

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // Allow picking the same file again.
    if (!file) return;
    setPhotoBusy(true);
    try {
      await applyAvatar(await uploadAvatar(userId, file));
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await applyAvatar(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Profile" />

      <section className="overflow-hidden rounded-[32px] border border-line bg-surface">
        <div className="h-28 bg-brand-gradient sm:h-36" aria-hidden />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar user={me} size="xl" className={cn("ring-4 ring-surface", photoBusy && "opacity-50")} />
              {photoBusy && (
                <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Updating photo">
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                </span>
              )}
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={photoBusy}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-fg text-canvas transition hover:scale-105 disabled:opacity-60"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={photoInput}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={onPhotoChange}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <PenLine className="h-3.5 w-3.5" />
              Edit profile
            </Button>
          </div>

          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight wrap-anywhere">{me.name}</h2>
          <p className="text-sm text-muted">@{me.username}</p>
          {me.bio && <p className="mt-3 text-[15px] leading-relaxed wrap-anywhere">{me.bio}</p>}
          {me.area && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {me.area}
            </p>
          )}
          {me.avatarUrl && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={photoBusy}
              className="mt-2 text-xs text-subtle underline-offset-2 hover:text-muted hover:underline disabled:opacity-50"
            >
              Remove photo
            </button>
          )}

          <dl className="mt-6 grid grid-cols-4 gap-2 text-center">
            <Stat value={vibe ? vibe.postCount : "–"} label="Vibes" />
            <Stat value={vibe ? vibe.streak : "–"} label="Streak" icon={<Flame className="h-4 w-4 text-warning" aria-hidden />} />
            <Stat value={socialReady ? myCircles.length : "–"} label="Circles" href="/circles" />
            <Stat
              value={socialReady ? friendIds.length : "–"}
              label={incoming ? `Friends · ${incoming} new` : "Friends"}
              href="/friends"
            />
          </dl>
        </div>
      </section>

      <section aria-labelledby="my-vibes" className="mt-8">
        <h2 id="my-vibes" className="mb-3 font-display text-lg font-semibold">
          Your vibes
        </h2>
        {myPosts.status === "loading" && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3" role="status" aria-label="Loading your vibes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}
        {myPosts.status === "error" && (
          <p className="text-sm text-danger" role="alert">
            {myPosts.error}{" "}
            <button type="button" onClick={myPosts.retry} className="font-medium underline">
              Try again
            </button>
          </p>
        )}
        {myPosts.status === "ready" && myPosts.posts.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="font-semibold">No vibes yet</p>
            <p className="mt-1 text-sm text-muted">What you share in your circles shows up here, just for you.</p>
            <Link href="/post" className={buttonStyles({ size: "sm", className: "mt-4" })}>
              Post your first vibe
            </Link>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {myPosts.posts.map((post) =>
            post.kind === "photo" ? (
              <div key={post.id} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-elevated">
                {post.imageUrl && (
                  // Private signed link: loaded directly, not copied into Next.js's image cache.
                  <Image
                    src={post.imageUrl}
                    alt={post.text || "Your photo"}
                    fill
                    sizes="(min-width: 768px) 240px, 33vw"
                    unoptimized
                    className="object-cover"
                  />
                )}
              </div>
            ) : (
              <div
                key={post.id}
                className={cn(
                  "flex aspect-[4/5] items-center overflow-hidden rounded-2xl p-3",
                  THEME_GRADIENTS[post.background ?? "violet"],
                  post.background === "lime" ? "text-emerald-950" : "text-white",
                )}
              >
                <p className="line-clamp-5 font-display text-xs font-semibold leading-snug wrap-anywhere sm:text-sm">{post.text}</p>
              </div>
            ),
          )}
        </div>
        {myPosts.hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" size="sm" onClick={myPosts.loadMore} disabled={myPosts.loadingMore}>
              {myPosts.loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Load more
            </Button>
          </div>
        )}
      </section>

      <div className="mt-10 space-y-6">
        <SettingsGroup icon={<Bell className="h-4 w-4" />} title="Notifications">
          <PushSettings />
        </SettingsGroup>

        <SettingsGroup icon={<ShieldCheck className="h-4 w-4" />} title="Privacy">
          <ul className="space-y-3 py-3.5 text-sm leading-relaxed">
            <li>
              <span className="font-medium">Your profile</span>
              <span className="block text-xs text-muted">
                Only visible to your friends, people in your circles, and people you invite or who invite you.
              </span>
            </li>
            <li>
              <span className="font-medium">Your vibes</span>
              <span className="block text-xs text-muted">
                Only members of the circle you post to can see them. Nothing on VYBZ is public.
              </span>
            </li>
            <li>
              <span className="font-medium">Finding you</span>
              <span className="block text-xs text-muted">
                People can only add you if they type your exact username.
              </span>
            </li>
          </ul>
        </SettingsGroup>

        <SettingsGroup icon={<Palette className="h-4 w-4" />} title="App">
          <InstallRow />
          <Switch
            label="Reduce motion"
            description="Turn off animations. Saved on this device."
            checked={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
          <ThemeSettings />
          <Row label="Language" note={<ComingSoon>Arabic coming soon</ComingSoon>}>
            <Segmented
              label="Language"
              value="en"
              onChange={() => {}}
              options={[
                { value: "en", label: "English" },
                { value: "ar", label: "العربية", disabled: true },
              ]}
              className="w-48"
            />
          </Row>
        </SettingsGroup>

        <SettingsGroup icon={<Globe2 className="h-4 w-4" />} title="Account">
          <form
            action={async () => {
              // Stop this device getting this account's alerts before logging out.
              await forgetThisDevice();
              await signOut();
            }}
            className="flex items-center justify-between gap-4 py-3.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">Log out</p>
              <p className="mt-0.5 truncate text-xs text-muted">Signed in as {email}</p>
            </div>
            <LogOutButton />
          </form>
        </SettingsGroup>

        <p className="pb-4 text-center text-xs text-subtle">VYBZ v0.2 · Made in Cairo · Beta</p>
      </div>

      <EditProfileSheet open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Stat({ value, label, icon, href }: { value: number | string; label: string; icon?: ReactNode; href?: string }) {
  return (
    <div className={cn("relative rounded-2xl bg-elevated px-1 py-3", href && "transition hover:bg-raised")}>
      <dd className="flex items-center justify-center gap-1 font-display text-xl font-bold tabular-nums">
        {icon}
        {value}
      </dd>
      <dt className="text-[11px] text-muted">{label}</dt>
      {/* The whole tile is clickable; the link sits on top so the dl/dd/dt structure stays valid. */}
      {href && <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={`${label}: ${value}`} />}
    </div>
  );
}

function LogOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      Log out
    </Button>
  );
}

function SettingsGroup({
  icon,
  title,
  note,
  children,
}: {
  icon: ReactNode;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-surface px-5 pt-4 pb-1">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
        <span className="text-brand-soft">{icon}</span>
        {title}
        {note}
      </h2>
      <div className="mt-1 divide-y divide-line">{children}</div>
    </section>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; preview: ReactNode }[] = [
  {
    value: "dark",
    label: "Dark",
    preview: (
      <span className="flex h-14 items-end gap-1 rounded-xl border border-white/10 bg-[#0b0b0f] p-2">
        <span className="h-full w-1/3 rounded-md bg-[#1a1a22]" />
        <span className="h-2/3 flex-1 rounded-md bg-[#8b5cf6]" />
      </span>
    ),
  },
  {
    value: "light",
    label: "Light",
    preview: (
      <span className="flex h-14 items-end gap-1 rounded-xl border border-black/10 bg-[#f6f5fa] p-2">
        <span className="h-full w-1/3 rounded-md bg-white shadow-sm" />
        <span className="h-2/3 flex-1 rounded-md bg-[#8b5cf6]" />
      </span>
    ),
  },
  {
    value: "system",
    label: "Auto",
    preview: (
      <span className="flex h-14 overflow-hidden rounded-xl border border-line">
        <span className="flex flex-1 items-end bg-[#0b0b0f] p-2">
          <span className="h-2/3 w-full rounded-md bg-[#8b5cf6]" />
        </span>
        <span className="flex flex-1 items-end bg-[#f6f5fa] p-2">
          <span className="h-2/3 w-full rounded-md bg-[#8b5cf6]" />
        </span>
      </span>
    ),
  },
];

/** Theme: Dark, Light or Auto (follows the device), saved on this device. "Customize theme" isn't built yet. */
function ThemeSettings() {
  const choice = useThemeChoice();
  return (
    <>
      <div className="py-3.5">
        <p className="text-sm font-medium">Theme</p>
        <p className="mt-0.5 text-xs text-muted">Saved on this device. Auto follows your phone or computer.</p>
        <div className="mt-3 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => {
            const selected = choice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex min-w-0 flex-col gap-2 rounded-2xl border p-2.5 text-left transition active:scale-[0.98]",
                  selected ? "border-brand/60 bg-brand/[0.08]" : "border-line hover:border-line-strong",
                )}
              >
                <span aria-hidden>{option.preview}</span>
                <span className="flex items-center justify-between gap-1 text-sm font-semibold">
                  {option.label}
                  {selected && <Check className="h-4 w-4 shrink-0 text-brand-soft" aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-between gap-3 py-3.5 text-left opacity-55"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Customize theme
            <ComingSoon />
          </span>
          <span className="mt-0.5 block text-xs text-muted">Choose your own accent colour and how VYBZ looks.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      </button>
    </>
  );
}

function Row({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        {label}
        {note}
      </span>
      {children}
    </div>
  );
}
