"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Globe2, ImagePlus, MapPin, Send, Trash2, Type } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { Button } from "@/components/ui/Button";
import { DemoNotice, Tag } from "@/components/ui/DemoNotice";
import { Segmented } from "@/components/ui/Segmented";
import { LIMITS, THEME_GRADIENTS, THEME_LABELS } from "@/lib/constants";
import { CURRENT_USER_ID, PROMPTS, TODAY_PROMPT_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { Post, ThemeColor } from "@/lib/types";
import { cn, newId } from "@/lib/utils";

type Mode = "photo" | "text";
type PickedImage = { url: string; isLocalFile: boolean };

const SAMPLE_PHOTOS = ["/samples/beach.jpg", "/samples/sunset.jpg", "/samples/laptop.jpg"];
const BACKGROUNDS = Object.keys(THEME_GRADIENTS) as ThemeColor[];

export function PostComposer() {
  const router = useRouter();
  const { me, circles, addPost, showToast } = useVybz();

  const [mode, setMode] = useState<Mode>("photo");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [text, setText] = useState("");
  const [background, setBackground] = useState<ThemeColor>("violet");
  const [promptId, setPromptId] = useState<string | null>(TODAY_PROMPT_ID);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  // Photos picked from the device get a temporary in-browser URL. We free it
  // when the photo is replaced or removed. (Next.js keeps this page alive in
  // the background when you navigate away, so an unfinished draft survives.)
  const localUrl = useRef<string | null>(null);

  function replaceImage(next: PickedImage | null) {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = next?.isLocalFile ? next.url : null;
    setImage(next);
  }

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Try a JPG, PNG or HEIC photo.");
      return;
    }
    if (file.size > LIMITS.maxImageMB * 1024 * 1024) {
      setError(`That photo is too big. Please pick one under ${LIMITS.maxImageMB} MB.`);
      return;
    }
    replaceImage({ url: URL.createObjectURL(file), isLocalFile: true });
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

  const draft: Post = {
    id: "draft",
    authorId: CURRENT_USER_ID,
    circleId,
    promptId,
    kind: mode,
    imageUrl: mode === "photo" ? image?.url : undefined,
    text: mode === "photo" ? caption.trim() : text.trim(),
    background: mode === "text" ? background : undefined,
    location: location.trim() || undefined,
    timeLabel: "now",
    reactions: { fire: 0, lol: 0, love: 0, care: 0, wow: 0 },
    myReaction: null,
  };

  const canPublish = mode === "photo" ? Boolean(image) : text.trim().length > 0;
  const missingHint = mode === "photo" ? "Add a photo to post" : "Write something to post";

  function publish() {
    if (!canPublish) return;
    addPost({ ...draft, id: newId("post") });
    showToast("Vibe posted! (demo: only on this device)");
    resetDraft();
    router.push("/");
  }

  /** Clears the form after publishing so the next visit starts fresh. */
  function resetDraft() {
    localUrl.current = null; // The published post still uses this photo, so don't free it.
    setImage(null);
    setCaption("");
    setText("");
    setLocation("");
    setMode("photo");
    setPromptId(TODAY_PROMPT_ID);
    setCircleId(null);
    setMobileView("edit");
    setError(null);
  }

  const form = (
    <div className="space-y-6">
      <DemoNotice>
        Your post appears in your feed on this device only. Nothing is uploaded, and it disappears when you refresh.
      </DemoNotice>

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
                <Image
                  src={image.url}
                  alt="Selected photo"
                  fill
                  sizes="(min-width: 1024px) 480px, 100vw"
                  unoptimized={image.isLocalFile}
                  className="object-cover"
                />
              </div>
              <div className="absolute right-3 top-3 flex gap-2">
                <Button size="sm" variant="glass" onClick={() => fileInput.current?.click()}>
                  Change
                </Button>
                <Button
                  size="icon"
                  variant="glass"
                  onClick={() => replaceImage(null)}
                  aria-label="Remove photo"
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
                  Tap to pick from your device{" "}
                  <span className="hidden sm:inline">or drag one here</span> · up to {LIMITS.maxImageMB} MB
                </span>
              </span>
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

          {!image && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">No photo handy? Try one:</span>
              {SAMPLE_PHOTOS.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => replaceImage({ url: src, isLocalFile: false })}
                  className="relative h-12 w-10 overflow-hidden rounded-lg border border-line transition hover:scale-105 hover:border-brand"
                  aria-label="Use sample photo"
                >
                  <Image src={src} alt="" fill sizes="40px" className="object-cover" />
                </button>
              ))}
            </div>
          )}

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

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section aria-label="Prompt">
        <p className="mb-2 text-sm font-medium">Answer a prompt</p>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((prompt) => (
            <ChoiceChip key={prompt.id} active={promptId === prompt.id} onClick={() => setPromptId(prompt.id)}>
              <span aria-hidden>{prompt.emoji}</span> {prompt.text}
              {prompt.id === TODAY_PROMPT_ID && <Tag tone="brand">Today</Tag>}
            </ChoiceChip>
          ))}
          <ChoiceChip active={promptId === null} onClick={() => setPromptId(null)}>
            No prompt
          </ChoiceChip>
        </div>
      </section>

      <section aria-label="Audience">
        <p className="mb-2 text-sm font-medium">Who can see it</p>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip active={circleId === null} onClick={() => setCircleId(null)}>
            <Globe2 className="h-3.5 w-3.5" aria-hidden /> All friends
          </ChoiceChip>
          {circles.map((circle) => (
            <ChoiceChip key={circle.id} active={circleId === circle.id} onClick={() => setCircleId(circle.id)}>
              <span aria-hidden>{circle.emoji}</span> {circle.name}
            </ChoiceChip>
          ))}
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
            onChange={(event) => setLocation(event.target.value.slice(0, 40))}
            placeholder="e.g. Zamalek"
            className="h-11 w-full bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
          />
        </span>
      </label>
    </div>
  );

  const publishButton = (
    <Button size="lg" onClick={publish} disabled={!canPublish} className="w-full">
      <Send className="h-4 w-4" />
      {canPublish ? "Publish vibe" : missingHint}
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
