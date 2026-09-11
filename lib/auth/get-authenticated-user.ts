import { cache } from "react";
import type { UserModel } from "@/generated/prisma/models/User";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseUserProfile } from "@/lib/auth/supabase-user-profile";

export const getAuthenticatedUser = cache(
  async (): Promise<UserModel | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) return null;

    const profile = getSupabaseUserProfile(data.user);

    const existingUser = await prisma.user.findUnique({
      where: { id: profile.id },
    });

    if (
      existingUser &&
      existingUser.email === profile.email &&
      existingUser.name === profile.name &&
      existingUser.image === profile.image
    ) {
      return existingUser;
    }

    return prisma.user.upsert({
      where: { id: profile.id },
      create: profile,
      update: profile,
    });
  },
);
