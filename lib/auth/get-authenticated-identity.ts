import { cache } from "react";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedIdentity = {
  id: string;
  email: string;
  name: string | null;
  user_metadata?: Record<string, unknown>;
};

export const getAuthenticatedIdentity = cache(
  async (): Promise<AuthenticatedIdentity | null> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getClaims();

      if (error || !data?.claims || typeof data.claims.sub !== "string") {
        return null;
      }

      const claims = data.claims;
      const userMetadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
      const email = typeof claims.email === "string" ? claims.email : "";
      const name =
        typeof userMetadata.name === "string" && userMetadata.name.trim()
          ? userMetadata.name.trim()
          : typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()
            ? userMetadata.full_name.trim()
            : null;

      return {
        id: claims.sub,
        email,
        name,
        user_metadata: userMetadata,
      };
    } catch {
      return null;
    }
  },
);
