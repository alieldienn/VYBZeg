"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, X } from "lucide-react";
import { UsernameField } from "@/components/profile/UsernameField";
import { Avatar } from "@/components/ui/Avatar";
import { FormError, TextField } from "@/components/ui/TextField";
import { completeOnboarding, signOut, type FormState } from "@/lib/auth/actions";
import { useUsernameCheck } from "@/lib/hooks/useUsernameCheck";
import { IMAGE_ACCEPT, imageFileError, toBrowserImage } from "@/lib/images";
import { deleteAvatar, uploadAvatar } from "@/lib/supabase/uploads";
import { DISPLAY_NAME_MAX } from "@/lib/validation";
import { AuthHeading, SubmitButton } from "./AuthForms";

/** Turns "Malak.Adel+test@gmail.com" into a starting suggestion like "malak.adeltest". */
function suggestUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20);
  return base.length >= 3 ? base : "";
}

export function OnboardingForm({ userId, email }: { userId: string; email: string }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState(() => suggestUsername(email));
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const usernameStatus = useUsernameCheck(username);
  const photoInput = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    let uploadedPath: string | null = null;
    if (photo) {
      try {
        uploadedPath = await uploadAvatar(userId, photo.file);
        formData.set("avatarPath", uploadedPath);
      } catch (error) {
        return { error: (error as Error).message };
      }
    }
    const result = await completeOnboarding(prev, formData);
    if (result.done) {
      // Profile saved: full page load into the app (see completeOnboarding).
      window.location.assign(result.done);
      return result;
    }
    // Saving failed: tidy up the photo nobody will use.
    if (uploadedPath && result.error) await deleteAvatar(uploadedPath);
    return result;
  }, {});

  // Free the temporary preview link when the photo changes or the page closes.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPhotoError(null);
    if (!file) return;
    const problem = imageFileError(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    try {
      // iPhone HEIC photos become JPEGs, so the preview works in every browser.
      const usable = await toBrowserImage(file);
      setPhoto({ file: usable, preview: URL.createObjectURL(usable) });
    } catch (failure) {
      setPhotoError((failure as Error).message);
    }
  }

  return (
    <>
      <AuthHeading title="Set up your profile" subtitle="This is what your friends will see." />
      <form action={action} className="space-y-5" noValidate>
        {state.error && !state.field && <FormError>{state.error}</FormError>}

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              user={{ name: displayName || username || "?", avatarHue: 270, avatarUrl: photo?.preview }}
              size="xl"
              className="ring-4 ring-elevated"
            />
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-fg text-canvas transition hover:scale-105"
              aria-label={photo ? "Change profile photo" : "Add a profile photo"}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={photoInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onPhotoChange} />
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-medium">Profile photo</p>
            <p className="text-xs text-muted">Optional. You can add one later.</p>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-subtle hover:text-muted"
              >
                <X className="h-3 w-3" aria-hidden /> Remove
              </button>
            )}
            {photoError && <p className="mt-1 text-xs text-danger">{photoError}</p>}
          </div>
        </div>

        <TextField
          label="Your name"
          name="displayName"
          autoComplete="name"
          placeholder="e.g. Malak Adel"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value.slice(0, DISPLAY_NAME_MAX))}
          error={state.field === "displayName" ? state.error : null}
        />
        <UsernameField
          value={username}
          onChange={setUsername}
          status={usernameStatus}
          serverError={state.field === "username" ? state.error : null}
        />

        <SubmitButton pending={pending || Boolean(state.done)}>
          {pending || state.done ? "Saving…" : "Let's go"}
        </SubmitButton>
      </form>
      <form action={signOut} className="mt-5 text-center text-xs text-subtle">
        Signed in as {email}.{" "}
        <button type="submit" className="font-medium text-muted underline-offset-2 hover:underline">
          Not you? Log out
        </button>
      </form>
    </>
  );
}
