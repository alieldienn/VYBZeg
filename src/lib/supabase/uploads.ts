import { prepareImage } from "@/lib/images";
import { createClient } from "./client";

/**
 * Uploads a profile photo to the public `avatars` bucket and returns its path.
 * Every upload gets a new random name inside the user's own folder, so files
 * are never overwritten (Storage policies also enforce the folder).
 */
export async function uploadAvatar(userId: string, file: File) {
  const blob = await prepareImage(file, { maxSide: 512, square: true });
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient()
    .storage.from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Your photo didn't upload. Check your connection and try again.");
  return path;
}

/** Deletes one of your own profile photos (used when replacing or removing it). */
export async function deleteAvatar(path: string) {
  await createClient().storage.from("avatars").remove([path]);
}
