import type { User } from "@/lib/types";
import type { Tables } from "./database.types";

type ProfileRow = Pick<Tables<"profiles">, "id" | "username" | "display_name" | "avatar_path" | "avatar_hue"> &
  Partial<Pick<Tables<"profiles">, "bio" | "area">>;

/**
 * Profile photos live in the PUBLIC `avatars` bucket, so their address can be
 * built directly. (Post photos are private and use signed URLs instead.)
 */
export function avatarPublicUrl(path: string | null | undefined) {
  if (!path) return undefined;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/avatars/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Converts a database profile row into the `User` shape the screens use. */
export function profileToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.display_name,
    username: row.username,
    avatarHue: row.avatar_hue,
    avatarUrl: avatarPublicUrl(row.avatar_path),
    bio: row.bio ?? undefined,
    area: row.area ?? undefined,
  };
}
