import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_A, USER_B } from "../fixtures";

const auth = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn() }));
const prisma = vi.hoisted(() => ({
  transaction: { create: vi.fn() },
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock("@/lib/auth/get-authenticated-user", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { importTransactionsAction } from "@/actions/import";

function makeFormData() {
  const formData = new FormData();
  formData.append(
    "file",
    new File(
      ["Divida,Forma,Vencimento,Valor\nConta teste 1,Pix,2026-09-10,10.00\nConta teste 2,Boleto,2026-09-11,20.00\nConta teste 3,Pix,2026-09-12,30.00"],
      "transactions.csv",
      { type: "text/csv" },
    ),
  );
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.getAuthenticatedUser.mockResolvedValue(USER_A);
  prisma.transaction.create.mockResolvedValue({});
});

describe("importTransactionsAction ownership", () => {
  it.each([USER_A, USER_B])("assigns every imported row to %s", async (user) => {
    auth.getAuthenticatedUser.mockResolvedValue(user);

    const result = await importTransactionsAction(makeFormData());

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(prisma.transaction.create).toHaveBeenCalledTimes(3);
    for (const [call] of prisma.transaction.create.mock.calls) {
      expect(call).toEqual({ data: expect.objectContaining({ userId: user.id }) });
    }
  });

  it("rejects anonymous import before parsing or Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await importTransactionsAction(makeFormData());

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});