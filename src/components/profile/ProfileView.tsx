"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Bell, Camera, Flame, Globe2, LogOut, MapPin, Palette, PenLine, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DemoNotice, Tag } from "@/components/ui/DemoNotice";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { LIMITS, REMINDER_TIMES, THEME_GRADIENTS } from "@/lib/constants";
import { CURRENT_USER_ID, SAMPLE_FRIEND_COUNT, SAMPLE_STREAK, TODAY_PROMPT_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EditProfileSheet } from "./EditProfileSheet";

export function ProfileView() {
  const { me, posts, circles, settings, updateSettings, updateProfile, showToast } = useVybz();
  const [editing, setEditing] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const myPosts = posts.filter((post) => post.authorId === CURRENT_USER_ID);
  const postedToday = myPosts.some((post) => post.promptId === TODAY_PROMPT_ID);
  const myCircles = circles.filter((circle) => circle.memberIds.includes(CURRENT_USER_ID));

  function removePhoto() {
    if (me.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(me.avatarUrl);
    updateProfile({ avatarUrl: undefined });
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > LIMITS.maxImageMB * 1024 * 1024) {
      showToast(`Pick an image under ${LIMITS.maxImageMB} MB`);
      return;
    }
    // Shown from a temporary in-browser URL. Nothing is uploaded.
    removePhoto();
    updateProfile({ avatarUrl: URL.createObjectURL(file) });
    showToast("Profile photo updated (demo)");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Profile" />

      <section className="overflow-hidden rounded-[32px] border border-line bg-surface">
        <div className="h-28 bg-brand-gradient sm:h-36" aria-hidden />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar user={me} size="xl" className="ring-4 ring-surface" />
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-fg text-canvas transition hover:scale-105"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
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
              className="mt-2 text-xs text-subtle underline-offset-2 hover:text-muted hover:underline"
            >
              Remove photo
            </button>
          )}

          <dl className="mt-6 grid grid-cols-4 gap-2 text-center">
            <Stat value={myPosts.length} label="Vibes" />
            <Stat value={SAMPLE_STREAK + (postedToday ? 1 : 0)} label="Streak" icon={<Flame className="h-4 w-4 text-warning" aria-hidden />} />
            <Stat value={myCircles.length} label="Circles" />
            <Stat value={SAMPLE_FRIEND_COUNT} label="Friends" />
          </dl>
        </div>
      </section>

      <section aria-labelledby="my-vibes" className="mt-8">
        <h2 id="my-vibes" className="mb-3 font-display text-lg font-semibold">
          Your vibes
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
        <DemoNotice>Settings work in the app but are not saved. They reset when you refresh.</DemoNotice>

        <SettingsGroup icon={<Bell className="h-4 w-4" />} title="Notifications">
          <Switch
            label="Daily Vibe reminder"
            description="A nudge when today's prompt drops"
            checked={settings.dailyReminder}
            onChange={(dailyReminder) => updateSettings({ dailyReminder })}
          />
          <div className={cn("pb-3.5", !settings.dailyReminder && "pointer-events-none opacity-40")}>
            <p className="mb-2 text-xs text-muted">Remind me in the…</p>
            <Segmented
              label="Reminder time"
              value={settings.reminderTime}
              onChange={(reminderTime) => updateSettings({ reminderTime })}
              options={REMINDER_TIMES.map((time) => ({ ...time, disabled: !settings.dailyReminder }))}
              className="flex-wrap"
            />
          </div>
          <Switch
            label="Reactions"
            description="When friends react to your vibes"
            checked={settings.notifyReactions}
            onChange={(notifyReactions) => updateSettings({ notifyReactions })}
          />
          <Switch
            label="Plans & polls"
            description="New plans and when a plan gets locked in"
            checked={settings.notifyPlans}
            onChange={(notifyPlans) => updateSettings({ notifyPlans })}
          />
          <Switch
            label="Circle activity"
            description="Every new post in your circles"
            checked={settings.notifyCircles}
            onChange={(notifyCircles) => updateSettings({ notifyCircles })}
          />
        </SettingsGroup>

        <SettingsGroup icon={<ShieldCheck className="h-4 w-4" />} title="Privacy">
          <Switch
            label="Private profile"
            description="Only approved friends can see your vibes"
            checked={settings.privateProfile}
            onChange={(privateProfile) => updateSettings({ privateProfile })}
          />
          <Switch
            label="Show when I'm active"
            description="Friends see a dot when you're online"
            checked={settings.showActivity}
            onChange={(showActivity) => updateSettings({ showActivity })}
          />
        </SettingsGroup>

        <SettingsGroup icon={<Palette className="h-4 w-4" />} title="App">
          <Switch
            label="Reduce motion"
            description="Turn off animations across the app"
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
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="text-sm font-medium">Log out</p>
              <p className="mt-0.5 text-xs text-muted">Accounts and sign-in arrive with the backend.</p>
            </div>
            <Button variant="danger" size="sm" disabled>
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </Button>
          </div>
        </SettingsGroup>

        <p className="pb-4 text-center text-xs text-subtle">VYBZ v0.1 · Made in Cairo · Demo build</p>
      </div>

      <EditProfileSheet open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-elevated px-1 py-3">
      <dd className="flex items-center justify-center gap-1 font-display text-xl font-bold tabular-nums">
        {icon}
        {value}
      </dd>
      <dt className="text-[11px] text-muted">{label}</dt>
    </div>
  );
}

function SettingsGroup({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line bg-surface px-5 pt-4 pb-1">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
        <span className="text-brand-soft">{icon}</span>
        {title}
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
