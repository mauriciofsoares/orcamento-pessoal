import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_A, USER_B } from "../fixtures";

const supabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabase),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER_A }, error: null });
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.upsert.mockResolvedValue(USER_A);
});

describe("getAuthenticatedUser", () => {
  function supabaseUser(overrides: Record<string, unknown> = {}) {
    return { ...USER_A, user_metadata: {}, ...overrides };
  }

  it("returns existing user without upserting when profile is unchanged", async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: supabaseUser({ user_metadata: { name: "User A" } }) },
      error: null,
    });
    prisma.user.findUnique.mockResolvedValueOnce(USER_A);

    const result = await getAuthenticatedUser();

    expect(result).toEqual(USER_A);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: USER_A.id } });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("maps a valid Supabase user and upserts by the same id", async () => {
    const result = await getAuthenticatedUser();

    expect(result).toEqual(USER_A);
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: USER_A.id },
      create: expect.objectContaining({ id: USER_A.id, email: USER_A.email }),
      update: expect.objectContaining({ id: USER_A.id, email: USER_A.email }),
    });
  });

  it("returns null when Supabase has no user", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getAuthenticatedUser()).resolves.toBeNull();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("throws when the authenticated user has no email", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { ...USER_A, email: null } },
      error: null,
    });

    await expect(getAuthenticatedUser()).rejects.toThrow("no email");
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("uses the same Supabase id for repeated upserts", async () => {
    await getAuthenticatedUser();
    await getAuthenticatedUser();

    expect(prisma.user.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: USER_A.id } }),
    );
  });

  it("resolves independent identities for two different sessions without leaking between them", async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: USER_A }, error: null });
    prisma.user.upsert.mockResolvedValueOnce(USER_A);
    const resultA = await getAuthenticatedUser();

    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: USER_B }, error: null });
    prisma.user.upsert.mockResolvedValueOnce(USER_B);
    const resultB = await getAuthenticatedUser();

    expect(resultA).toEqual(USER_A);
    expect(resultB).toEqual(USER_B);
    expect(resultA?.id).not.toBe(resultB?.id);
    expect(prisma.user.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: USER_A.id } }),
    );
    expect(prisma.user.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: USER_B.id } }),
    );
  });

  it.each([
    [{ full_name: "Nome Completo" }, "Nome Completo"],
    [{ name: "Nome Alternativo" }, "Nome Alternativo"],
  ])("maps the preferred name metadata", async (user_metadata, expectedName) => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: supabaseUser({ user_metadata }) },
      error: null,
    });

    await getAuthenticatedUser();

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: expectedName }),
        update: expect.objectContaining({ name: expectedName }),
      }),
    );
  });

  it.each([
    [{ avatar_url: "https://example.test/avatar.png" }, "https://example.test/avatar.png"],
    [{ picture: "https://example.test/picture.png" }, "https://example.test/picture.png"],
  ])("maps the preferred image metadata", async (user_metadata, expectedImage) => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: supabaseUser({ user_metadata }) },
      error: null,
    });

    await getAuthenticatedUser();

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ image: expectedImage }),
        update: expect.objectContaining({ image: expectedImage }),
      }),
    );
  });
});