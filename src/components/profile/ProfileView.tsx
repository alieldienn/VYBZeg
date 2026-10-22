"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Bell, Camera, Flame, Globe2, Loader2, LogOut, MapPin, Palette, PenLine, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/DemoNotice";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { signOut } from "@/lib/auth/actions";
import { REMINDER_TIMES, THEME_GRADIENTS } from "@/lib/constants";
import { setAvatar } from "@/lib/profile/actions";
import { SAMPLE_STREAK, TODAY_PROMPT_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import { deleteAvatar, uploadAvatar } from "@/lib/supabase/uploads";
import { cn } from "@/lib/utils";
import { EditProfileSheet } from "./EditProfileSheet";

export function ProfileView() {
  const router = useRouter();
  const { me, userId, email, posts, circles, friendIds, requests, social, settings, updateSettings, updateProfile, showToast } =
    useVybz();
  const [editing, setEditing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  // Posts are sample data until Stage 6; circles are real.
  const myPosts = posts.filter((post) => post.authorId === me.id);
  const postedToday = myPosts.some((post) => post.promptId === TODAY_PROMPT_ID);
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
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                className="hidden"
                onChange={onPhotoChange}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <PenLine className="h-3.5 w-3.5" />
              Edit profile
            </Button>
          </div>

          <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">{me.name}</h2>
          <p className="text-sm text-muted">@{me.username}</p>
          {me.bio && <p className="mt-3 text-[15px] leading-relaxed">{me.bio}</p>}
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
            <Stat value={myPosts.length} label="Vibes" />
            <Stat value={SAMPLE_STREAK + (postedToday ? 1 : 0)} label="Streak" icon={<Flame className="h-4 w-4 text-warning" aria-hidden />} />
            <Stat value={socialReady ? myCircles.length : "–"} label="Circles" href="/circles" />
            <Stat
              value={socialReady ? friendIds.length : "–"}
              label={incoming ? `Friends · ${incoming} new` : "Friends"}
              href="/friends"
            />
          </dl>
          <p className="mt-2 text-center text-[11px] text-subtle">
            Vibes and streak show sample data until posting is connected.
          </p>
        </div>
      </section>

      <section aria-labelledby="my-vibes" className="mt-8">
        <h2 id="my-vibes" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          Your vibes <Tag>Sample</Tag>
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {myPosts.map((post) =>
            post.kind === "photo" && post.imageUrl ? (
              <div key={post.id} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-elevated">
                <Image
                  src={post.imageUrl}
                  alt={post.text || "Your photo"}
                  fill
                  sizes="(min-width: 768px) 240px, 33vw"
                  unoptimized={post.imageUrl.startsWith("blob:")}
                  className="object-cover"
                />
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
                <p className="line-clamp-5 font-display text-xs font-semibold leading-snug sm:text-sm">{post.text}</p>
              </div>
            ),
          )}
        </div>
      </section>

      <div className="mt-10 space-y-6">
        <SettingsGroup icon={<Bell className="h-4 w-4" />} title="Notifications" note={<Tag tone="soon">Soon</Tag>}>
          <p className="pt-2 text-xs leading-relaxed text-muted">
            Reminders and notifications arrive in a later update. These options are a preview and can&apos;t be
            changed yet.
          </p>
          <Switch label="Daily Vibe reminder" description="A nudge when today's prompt drops" checked={false} onChange={() => {}} disabled />
          <div className="pointer-events-none pb-3.5 opacity-40">
            <p className="mb-2 text-xs text-muted">Remind me in the…</p>
            <Segmented
              label="Reminder time"
              value="surprise"
              onChange={() => {}}
              options={REMINDER_TIMES.map((time) => ({ ...time, disabled: true }))}
              className="flex-wrap"
            />
          </div>
          <Switch label="Reactions" description="When friends react to your vibes" checked={false} onChange={() => {}} disabled />
          <Switch label="Plans & polls" description="New plans and when a plan gets locked in" checked={false} onChange={() => {}} disabled />
          <Switch label="Circle activity" description="Every new post in your circles" checked={false} onChange={() => {}} disabled />
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
          <Switch
            label="Reduce motion"
            description="Turn off animations. Saved on this device."
            checked={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
          <Row label="Theme" note={<Tag tone="soon">Light mode soon</Tag>}>
            <Segmented
              label="Theme"
              value="dark"
              onChange={() => {}}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light", disabled: true },
              ]}
              className="w-40"
            />
          </Row>
          <Row label="Language" note={<Tag tone="soon">Arabic soon</Tag>}>
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
          <form action={signOut} className="flex items-center justify-between gap-4 py-3.5">
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
