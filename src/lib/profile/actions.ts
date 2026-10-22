"use server";

/*
 * Saving your own profile. Each action re-checks who is logged in and
 * re-validates every field; Row Level Security in the database additionally
 * guarantees nobody can change someone else's profile.
 */
import type { FormState } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";
import { avatarPublicUrl } from "@/lib/supabase/avatars";
import { createClient } from "@/lib/supabase/server";
import {
  areaError,
  bioError,
  cleanDisplayName,
  displayNameError,
  usernameError,
} from "@/lib/validation";

const SESSION_EXPIRED = "Your session expired. Please log in again.";

export type SavedProfile = { name: string; username: string; bio?: string; area?: string };

export async function saveProfile(
  _prev: FormState & { saved?: SavedProfile },
  formData: FormData,
): Promise<FormState & { saved?: SavedProfile }> {
  const user = await getSessionUser();
  if (!user) return { error: SESSION_EXPIRED, field: "session" };

  const field = (name: string) => String(formData.get(name) ?? "");
  const displayName = cleanDisplayName(field("displayName"));
  const username = field("username").trim().toLowerCase();
  const bio = field("bio").trim();
  const area = field("area").trim();
  const values = { displayName, username, bio, area };

  const problems: [string, string | null][] = [
    ["displayName", displayNameError(displayName)],
    ["username", usernameError(username)],
    ["bio", bioError(bio)],
    ["area", areaError(area)],
  ];
  const problem = problems.find(([, message]) => message);
  if (problem) return { error: problem[1]!, field: problem[0], values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username, bio: bio || null, area: area || null })
    .eq("id", user.id)
    .select("display_name, username, bio, area")
    .maybeSingle();

  if (error?.code === "23505") return { error: `@${username} is taken. Try another one.`, field: "username", values };
  if (error || !data) return { error: "We couldn't save your profile. Please try again.", values };

  return {
    saved: { name: data.display_name, username: data.username, bio: data.bio ?? undefined, area: data.area ?? undefined },
  };
}

/**
 * Points your profile at a newly uploaded photo (or removes it with `null`),
 * then deletes the old file so unused photos don't pile up in Storage.
 */
export async function setAvatar(
  newPath: string | null,
): Promise<{ error?: string; expired?: boolean; avatarUrl?: string | null }> {
  const user = await getSessionUser();
  if (!user) return { error: SESSION_EXPIRED, expired: true };
  if (newPath !== null && (typeof newPath !== "string" || !newPath.startsWith(`${user.id}/`))) {
    return { error: "That photo upload didn't work. Please try again." };
  }

  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();

  const { error } = await supabase.from("profiles").update({ avatar_path: newPath }).eq("id", user.id);
  if (error) return { error: "We couldn't update your photo. Please try again." };

  const oldPath = before?.avatar_path;
  if (oldPath && oldPath !== newPath) {
    // Best effort: if this fails the profile is still correct, just an unused file remains.
    await supabase.storage.from("avatars").remove([oldPath]);
  }
  return { avatarUrl: avatarPublicUrl(newPath) ?? null };
}
