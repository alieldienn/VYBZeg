"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { ImagePlus, Loader2, MapPin, Send, Trash2, Type, UsersRound } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { Segmented } from "@/components/ui/Segmented";
import { LIMITS, THEME_GRADIENTS, THEME_LABELS } from "@/lib/constants";
import { cairoDay } from "@/lib/dates";
import { createPost, fetchRecentPrompts } from "@/lib/posts";
import { useVybz } from "@/lib/store";
import type { Post, Prompt, ThemeColor } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "photo" | "text";
type PickedImage = { url: string; file: File };

const BACKGROUNDS = Object.keys(THEME_GRADIENTS) as ThemeColor[];
const LOCATION_MAX = 40;

/** Reads ?circle= and ?prompt= from the address, so it must sit inside <Suspense>. */
export function PostComposer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, circles, social, showToast, postsChanged, reloadSocial } = useVybz();

  const [mode, setMode] = useState<Mode>("photo");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [text, setText] = useState("");
  const [background, setBackground] = useState<ThemeColor>("violet");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  // `undefined` = not chosen yet (use the default), `null` = "No prompt".
  const [promptChoice, setPromptChoice] = useState<string | null | undefined>(undefined);
  const [circleChoice, setCircleChoice] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState<null | "uploading" | "posting">(null);

  const fileInput = useRef<HTMLInputElement>(null);
  // Picked photos get a temporary in-browser preview link, freed when replaced.
  // (Next.js keeps this page alive in the background, so an unfinished draft survives.)
  const localUrl = useRef<string | null>(null);

  // Load recent prompts; today's is the newest.
  useEffect(() => {
    let cancelled = false;
    fetchRecentPrompts(6).then((result) => {
      if (!cancelled && result.prompts) setPrompts(result.prompts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const today = cairoDay();
  const todaysPrompt = prompts.find((p) => p.activeDate === today);
  const askedPrompt = searchParams.get("prompt");
  const promptId =
    promptChoice !== undefined
      ? promptChoice
      : prompts.some((p) => p.id === askedPrompt)
        ? askedPrompt
        : (todaysPrompt?.id ?? null);

  // The circle: your pick, else ?circle= from the address, else your only circle.
  const askedCircle = searchParams.get("circle");
  const circleId =
    circleChoice ??
    (circles.some((c) => c.id === askedCircle) ? askedCircle : circles.length === 1 ? circles[0].id : null);
  const circle = circles.find((c) => c.id === circleId);

  function replaceImage(next: PickedImage | null) {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = next?.url ?? null;
    setImage(next);
  }

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't a photo. Try a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > LIMITS.maxImageMB * 1024 * 1024) {
      setError(`That photo is too big. Please pick one under ${LIMITS.maxImageMB} MB.`);
      return;
    }
    replaceImage({ url: URL.createObjectURL(file), file });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    event.target.value = ""; // Allow picking the same file again.
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  const chosenPrompt = prompts.find((p) => p.id === promptId);
  const draft: Post = {
    id: "draft",
    authorId: me.id,
    circleId,
    promptId,
    prompt: chosenPrompt ? { emoji: chosenPrompt.emoji, text: chosenPrompt.text } : undefined,
    kind: mode,
    imageUrl: mode === "photo" ? image?.url : undefined,
    text: mode === "photo" ? caption.trim() : text.trim(),
    background: mode === "text" ? background : undefined,
    location: location.trim() || undefined,
    createdAt: new Date(0).toISOString(),
    timeLabel: "now",
    reactions: { fire: 0, lol: 0, love: 0, care: 0, wow: 0 },
    myReaction: null,
    commentCount: 0,
  };

  const hasContent = mode === "photo" ? Boolean(image) : text.trim().length > 0;
  const canPublish = hasContent && Boolean(circleId) && !publishing;
  const missingHint = !hasContent
    ? mode === "photo"
      ? "Add a photo to post"
      : "Write something to post"
    : !circleId
      ? "Pick a circle"
      : "Publish vibe";

  async function publish() {
    if (!canPublish || !circleId) return;
    setError(null);
    setPublishing(mode === "photo" ? "uploading" : "posting");
    const result = await createPost({
      userId: me.id,
      circleId,
      photo: mode === "photo" ? image?.file : undefined,
      text: mode === "photo" ? caption : text,
      background: mode === "text" ? background : undefined,
      promptId,
      location,
    });
    setPublishing(null);
    if (result.error) {
      setError(result.error);
      if (result.expired) router.push("/login");
      return;
    }
    showToast(`Vibe posted to ${circle?.emoji ?? ""} ${circle?.name ?? "your circle"}`);
    postsChanged();
    void reloadSocial(); // Updates "new today" and streaks on circle cards.
    resetDraft();
    router.push("/");
  }

  /** Clears the form after publishing so the next visit starts fresh. */
  function resetDraft() {
    replaceImage(null);
    setCaption("");
    setText("");
    setLocation("");
    setMode("photo");
    setPromptChoice(undefined);
    setCircleChoice(null);
    setMobileView("edit");
    setError(null);
  }

  if (social.status === "ready" && circles.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-dashed border-line-strong px-6 py-12 text-center">
        <UsersRound className="mx-auto h-10 w-10 text-brand-soft" aria-hidden />
        <p className="mt-3 font-display text-lg font-semibold">You need a circle to post</p>
        <p className="mt-1 text-sm text-muted">
          Vibes are only shared inside circles, so only your closest people see them.
        </p>
        <Link href="/circles" className={buttonStyles({ className: "mt-5" })}>
          Start or join a circle
        </Link>
      </div>
    );
  }

  const form = (
    <div className="space-y-6">
      <Segmented
        label="Post type"
        value={mode}
        onChange={(value) => {
          setMode(value);
          setError(null);
        }}
        options={[
          { value: "photo", label: "Photo", icon: <ImagePlus className="h-4 w-4" /> },
          { value: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
        ]}
      />

      {mode === "photo" ? (
        <section className="space-y-3" aria-label="Photo">
          {image ? (
            <div className="relative overflow-hidden rounded-3xl border border-line">
              <div className="relative aspect-[4/5] max-h-[420px] w-full">
                <Image src={image.url} alt="Selected photo" fill sizes="(min-width: 1024px) 480px, 100vw" unoptimized className="object-cover" />
              </div>
              <div className="absolute right-3 top-3 flex gap-2">
                <Button size="sm" variant="glass" onClick={() => fileInput.current?.click()} disabled={Boolean(publishing)}>
                  Change
                </Button>
                <Button
                  size="icon"
                  variant="glass"
                  onClick={() => replaceImage(null)}
                  aria-label="Remove photo"
                  disabled={Boolean(publishing)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all",
                dragging ? "border-brand bg-brand/10" : "border-line-strong bg-surface hover:border-brand/50 hover:bg-brand/5",
              )}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
                <ImagePlus className="h-7 w-7" />
              </span>
              <span>
                <span className="block font-semibold">Choose a photo</span>
                <span className="mt-1 block text-sm text-muted">
                  Tap to pick from your device <span className="hidden sm:inline">or drag one here</span> · up to{" "}
                  {LIMITS.maxImageMB} MB
                </span>
              </span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
            className="hidden"
            onChange={onFileChange}
          />
          <p className="text-xs text-subtle">Photos are resized and their hidden location data is removed before upload.</p>

          <Field label="Caption" count={caption.length} max={LIMITS.caption}>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, LIMITS.caption))}
              placeholder="Say something about it…"
              rows={2}
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
            />
          </Field>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Text">
          <Field label="Your text" count={text.length} max={LIMITS.textPost}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, LIMITS.textPost))}
              placeholder="Hot take, thought, update… go."
              rows={4}
              autoFocus
              className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-lg placeholder:text-subtle focus:border-brand/60 focus:outline-none"
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Background</p>
            <div className="flex gap-2.5" role="radiogroup" aria-label="Background">
              {BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={background === color}
                  aria-label={THEME_LABELS[color]}
                  onClick={() => setBackground(color)}
                  className={cn(
                    "h-10 w-10 rounded-full transition-all",
                    THEME_GRADIENTS[color],
                    background === color ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-canvas" : "opacity-80 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section aria-label="Circle">
        <p className="mb-2 text-sm font-medium">Share with</p>
        {social.status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your circles…
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {circles.map((c) => (
              <ChoiceChip key={c.id} active={circleId === c.id} onClick={() => setCircleChoice(c.id)}>
                <span aria-hidden>{c.emoji}</span> {c.name}
              </ChoiceChip>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-subtle">Only members of this circle will see it.</p>
      </section>

      <section aria-label="Prompt">
        <p className="mb-2 text-sm font-medium">Answer a prompt</p>
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <ChoiceChip key={prompt.id} active={promptId === prompt.id} onClick={() => setPromptChoice(prompt.id)}>
              <span aria-hidden>{prompt.emoji}</span> {prompt.text}
              {prompt.activeDate === today && <Tag tone="brand">Today</Tag>}
            </ChoiceChip>
          ))}
          <ChoiceChip active={promptId === null} onClick={() => setPromptChoice(null)}>
            No prompt
          </ChoiceChip>
        </div>
      </section>

      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-sm font-medium">
          Location <span className="text-xs font-normal text-subtle">(optional)</span>
        </span>
        <span className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand/60">
          <MapPin className="h-4 w-4 text-subtle" aria-hidden />
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value.slice(0, LOCATION_MAX))}
            placeholder="e.g. Zamalek"
            className="h-11 w-full bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
          />
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );

  const publishButton = (
    <Button size="lg" onClick={publish} disabled={!canPublish} className="w-full" aria-busy={Boolean(publishing)}>
      {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" />}
      {publishing === "uploading" ? "Uploading photo…" : publishing === "posting" ? "Posting…" : missingHint}
    </Button>
  );

  return (
    <div>
      <Segmented
        label="Editor view"
        className="mb-5 lg:hidden"
        value={mobileView}
        onChange={setMobileView}
        options={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className={cn(mobileView === "preview" && "hidden lg:block")}>
          {form}
          <div className="mt-8 lg:hidden">{publishButton}</div>
        </div>
        <div className={cn("lg:sticky lg:top-8 lg:self-start", mobileView === "edit" && "hidden lg:block")}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Live preview</p>
          <PostCard post={draft} author={me} preview />
          <div className="mt-5">{publishButton}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, count, max, children }: { label: string; count: number; max: number; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-medium">
        {label}
        <span className={cn("text-xs tabular-nums", count >= max ? "text-danger" : "text-subtle")}>
          {count}/{max}
        </span>
      </span>
      {children}
    </label>
  );
}

function ChoiceChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-sm transition-all",
        active
          ? "border-brand/60 bg-brand/15 text-fg"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
