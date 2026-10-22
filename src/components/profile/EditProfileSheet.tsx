"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { LIMITS } from "@/lib/constants";
import { CURRENT_USER_ID } from "@/lib/sample-data";
import { useVybz } from "@/lib/store";
import type { User } from "@/lib/types";

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

function usernameError(username: string, users: User[]) {
  if (!USERNAME_PATTERN.test(username)) {
    return "3–20 characters: lowercase letters, numbers, dots and underscores.";
  }
  if (users.some((user) => user.id !== CURRENT_USER_ID && user.username === username)) {
    return "That username is taken.";
  }
  return null;
}

/** Wrapper that resets the form every time the sheet opens. */
export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useVybz();
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" description="Changes are saved on this device only (demo).">
      {open && <EditProfileForm key={me.username} me={me} onDone={onClose} />}
    </Sheet>
  );
}

function EditProfileForm({ me, onDone }: { me: User; onDone: () => void }) {
  const { users, updateProfile, showToast } = useVybz();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio ?? "");
  const [area, setArea] = useState(me.area ?? "");

  const nameError = name.trim().length < 2 ? "Your name needs at least 2 characters." : null;
  const handleError = usernameError(username, users);
  const valid = !nameError && !handleError;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    updateProfile({ name: name.trim(), username, bio: bio.trim(), area: area.trim() });
    showToast("Profile updated");
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Input label="Name" value={name} onChange={(v) => setName(v.slice(0, 40))} error={nameError} />
      <Input
        label="Username"
        prefix="@"
        value={username}
        onChange={(v) => setUsername(v.toLowerCase().replace(/\s/g, "").slice(0, 20))}
        error={handleError}
      />
      <label className="block">
        <span className="mb-2 flex items-center justify-between text-sm font-medium">
          Bio
          <span className="text-xs font-normal text-subtle">
            {bio.length}/{LIMITS.bio}
          </span>
        </span>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value.slice(0, LIMITS.bio))}
          rows={3}
          placeholder="A little about you"
          className="w-full resize-none rounded-2xl border border-line bg-elevated px-4 py-3 text-[15px] placeholder:text-subtle focus:border-brand/60 focus:outline-none"
        />
      </label>
      <Input label="Area" value={area} onChange={(v) => setArea(v.slice(0, 40))} placeholder="e.g. Maadi, Cairo" />
      <Button type="submit" size="lg" className="w-full" disabled={!valid}>
        Save changes
      </Button>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  prefix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  prefix?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <span
        className={
          "flex items-center rounded-2xl border bg-elevated px-4 focus-within:border-brand/60 " +
          (error ? "border-danger/60" : "border-line")
        }
      >
        {prefix && <span className="mr-0.5 text-subtle">{prefix}</span>}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="h-12 w-full bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
        />
      </span>
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
}
