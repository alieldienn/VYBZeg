"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { Sheet } from "@/components/ui/Sheet";
import { THEME_GRADIENTS } from "@/lib/constants";
import { IMAGE_ACCEPT, imageFileError, toBrowserImage } from "@/lib/images";
import { updateCircleIcon } from "@/lib/social";
import { useVybz } from "@/lib/store";
import type { Circle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CircleIcon } from "./CircleIcon";

/**
 * Lets the circle's owner (or an admin) pick its emoji or give it a photo.
 * Render it with a new `key` each time it opens, so it starts from the circle's current icon.
 */
export function EditCircleIconSheet({ circle, open, onClose }: { circle: Circle; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { reloadSocial, showToast } = useVybz();
  const [emoji, setEmoji] = useState(circle.emoji);
  // undefined = keep the current photo, null = remove it, File = use this new one.
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Free the temporary preview link when it changes or the sheet closes.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const shownImage = photo === null ? undefined : (preview ?? circle.imageUrl);
  const changed = emoji !== circle.emoji || photo !== undefined;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError(null);
    if (!file) return;
    const problem = imageFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    setOpening(true);
    try {
      // iPhone HEIC photos become JPEGs, so the preview works in every browser.
      const usable = await toBrowserImage(file);
      setPhoto(usable);
      setPreview(URL.createObjectURL(usable));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setOpening(false);
    }
  }

  function removePhoto() {
    setPhoto(circle.imagePath ? null : undefined);
    setPreview(null);
  }

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    const result = await updateCircleIcon(circle, { emoji, photo });
    if (result.error) {
      setSaving(false);
      setError(result.error);
      if (result.expired) router.push("/login");
      return;
    }
    await reloadSocial();
    setSaving(false);
    showToast("Circle icon updated");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Circle icon"
      description="Pick an emoji, or use a photo instead. Everyone in the circle will see it."
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={!changed || saving || opening} aria-busy={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save icon"}
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className={cn("flex h-32 items-center justify-center rounded-3xl", THEME_GRADIENTS[circle.color])}>
          <CircleIcon emoji={emoji} imageUrl={shownImage} size="h-24 w-24" emojiSize="text-6xl" />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Photo</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={opening || saving}>
              {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" />}
              {shownImage ? "Change photo" : "Add a photo"}
            </Button>
            {shownImage && (
              <Button variant="ghost" onClick={removePhoto} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Use emoji instead
              </Button>
            )}
          </div>
          <input ref={fileInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onFile} />
          <p className="mt-2 text-xs text-subtle">
            Photos are cropped square and their hidden location data is removed. Anyone with the photo&apos;s link can
            open it, like profile photos.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Emoji</p>
          <EmojiPicker label="Circle emoji" value={emoji} onChange={setEmoji} />
          {shownImage && <p className="mt-2 text-xs text-subtle">The emoji is used in lists and chips; the photo shows on the circle itself.</p>}
        </div>
      </div>
    </Sheet>
  );
}
