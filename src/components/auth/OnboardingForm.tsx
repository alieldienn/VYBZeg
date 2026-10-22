"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FormError, TextField } from "@/components/ui/TextField";
import { completeOnboarding, signOut, type FormState } from "@/lib/auth/actions";
import { LIMITS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { deleteAvatar, uploadAvatar } from "@/lib/supabase/uploads";
import { AuthHeading, SubmitButton } from "./AuthForms";

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

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
  // Result of the last "is this username free?" lookup.
  const [lookup, setLookup] = useState<{ username: string; taken: boolean } | null>(null);
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
    // Saving failed: tidy up the photo nobody will use.
    if (uploadedPath && result?.error) await deleteAvatar(uploadedPath);
    return result ?? {};
  }, {});

  const usernameValid = USERNAME_PATTERN.test(username);
  const checking = usernameValid && lookup?.username !== username;
  const taken = usernameValid && lookup?.username === username && lookup.taken;

  // Ask the database whether the username is free, shortly after typing stops.
  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("find_profile_by_username", { p_username: username });
      if (!cancelled && !error) setLookup({ username, taken: (data ?? []).length > 0 });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  // Free the temporary preview link when the photo changes or the page closes.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPhotoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > LIMITS.maxImageMB * 1024 * 1024) {
      setPhotoError(`Pick a photo (JPG, PNG or WebP) under ${LIMITS.maxImageMB} MB.`);
      return;
    }
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  const usernameError =
    state.field === "username"
      ? state.error
      : username && !usernameValid
        ? "3–20 characters: lowercase letters, numbers, dots and underscores."
        : taken
          ? `@${username} is taken. Try another one.`
          : null;

  const usernameHint = checking ? (
    <span className="inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking…
    </span>
  ) : usernameValid && lookup ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="h-3 w-3" aria-hidden /> @{username} is available
    </span>
  ) : (
    "This is how friends find you."
  );

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
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic" className="hidden" onChange={onPhotoChange} />
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
          onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
          error={state.field === "displayName" ? state.error : null}
        />
        <TextField
          label="Username"
          name="username"
          prefix="@"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s/g, "").slice(0, 20))}
          error={usernameError}
          hint={usernameHint}
        />

        <SubmitButton pending={pending}>{pending ? "Saving…" : "Let's go"}</SubmitButton>
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
