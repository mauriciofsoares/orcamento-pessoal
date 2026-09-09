import type { User as SupabaseUser } from "@supabase/supabase-js";

function metadataString(user: SupabaseUser, keys: string[]) {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function getSupabaseUserProfile(user: SupabaseUser) {
  if (!user.email) {
    throw new Error("Authenticated Supabase user has no email.");
  }

  return {
    id: user.id,
    email: user.email,
    name: metadataString(user, ["full_name", "name"]),
    image: metadataString(user, ["avatar_url", "picture"]),
  };
}
