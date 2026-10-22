"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { FormError, TextField } from "@/components/ui/TextField";
import { LIMITS } from "@/lib/constants";
import { useUsernameCheck } from "@/lib/hooks/useUsernameCheck";
import { saveProfile, type SavedProfile } from "@/lib/profile/actions";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";
import { AREA_MAX, DISPLAY_NAME_MAX, displayNameError } from "@/lib/validation";
import { UsernameField } from "./UsernameField";

/** Wrapper that resets the form every time the sheet opens. */
export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useVybz();
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" description="Friends and people in your circles see this.">
      {open && <EditProfileForm me={me} onDone={onClose} />}
    </Sheet>
  );
}

type SaveState = Awaited<ReturnType<typeof saveProfile>>;

function EditProfileForm({ me, onDone }: { me: User; onDone: () => void }) {
  const router = useRouter();
  const { updateProfile, showToast } = useVybz();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio ?? "");
  const [area, setArea] = useState(me.area ?? "");
  const usernameStatus = useUsernameCheck(username, me.username);

  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, formData) => {
    const result = await saveProfile(prev, formData);
    if (result.saved) {
      const saved: SavedProfile = result.saved;
      updateProfile(saved);
      showToast("Profile updated");
      onDone();
    } else if (result.field === "session") {
      showToast(result.error ?? "Please log in again.", "error");
      router.push("/login");
    }
    return result;
  }, {});

  const nameError = state.field === "displayName" ? state.error : name ? displayNameError(name) : null;
  const canSave =
    !pending && !displayNameError(name) && (usernameStatus === "available" || usernameStatus === "yours");

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && !["displayName", "username", "bio", "area", "session"].includes(state.field ?? "") && (
        <FormError>{state.error}</FormError>
      )}
      <TextField
        label="Name"
        name="displayName"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value.slice(0, DISPLAY_NAME_MAX))}
        error={nameError}
      />
      <UsernameField
        value={username}
        onChange={setUsername}
        status={usernameStatus}
        serverError={state.field === "username" ? state.error : null}
      />
      <label className="block">
        <span className="mb-2 flex items-center justify-between text-sm font-medium">
          Bio
          <span className="text-xs font-normal text-subtle">
            {bio.length}/{LIMITS.bio}
          </span>
        </span>
        <textarea
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, LIMITS.bio))}
          rows={3}
          placeholder="A little about you"
          className="w-full resize-none rounded-2xl border border-line bg-elevated px-4 py-3 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
        />
        {state.field === "bio" && <span className="mt-1.5 block text-xs text-danger">{state.error}</span>}
      </label>
      <TextField
        label="Area"
        name="area"
        value={area}
        onChange={(event) => setArea(event.target.value.slice(0, AREA_MAX))}
        placeholder="e.g. Maadi, Cairo"
        error={state.field === "area" ? state.error : null}
      />
      <Button type="submit" size="lg" className="w-full" disabled={!canSave} aria-busy={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
