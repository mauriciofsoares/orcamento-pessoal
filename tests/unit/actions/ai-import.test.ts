import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_A, USER_B } from "../fixtures";

const auth = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), getAuthenticatedIdentity: vi.fn() }));
const prisma = vi.hoisted(() => ({
  transaction: { create: vi.fn() },
  $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));
const ai = vi.hoisted(() => ({ generateObject: vi.fn() }));
const groq = vi.hoisted(() => ({ groq: vi.fn(() => ({ mocked: true })) }));

vi.mock("@/lib/auth/get-authenticated-user", () => auth);
vi.mock("@/lib/auth/get-authenticated-identity", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("ai", () => ai);
vi.mock("@ai-sdk/groq", () => groq);

import { importWithAIAction, saveAiTransactionsAction } from "@/actions/ai-import";

const items = [
  {
    title: "Importado",
    amount: 10,
    dueDate: "2026-09-10",
    type: "EXPENSE" as const,
    paymentMethod: "Pix",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.getAuthenticatedUser.mockResolvedValue(USER_A);
  auth.getAuthenticatedIdentity.mockResolvedValue(USER_A);
  prisma.transaction.create.mockResolvedValue({});
  ai.generateObject.mockResolvedValue({ object: { transactions: items } });
});

describe("saveAiTransactionsAction ownership", () => {
  it.each([USER_A, USER_B])("assigns generated rows to %s", async (user) => {
    auth.getAuthenticatedUser.mockResolvedValue(user);

    const result = await saveAiTransactionsAction([{ ...items[0], userId: USER_B.id }]);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: user.id }),
    });
  });

  it("rejects anonymous save before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await saveAiTransactionsAction(items);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});

describe("importWithAIAction normalization", () => {
  it("converte a primeira letra do titulo para maiuscula", async () => {
    ai.generateObject.mockResolvedValueOnce({
      object: {
        transactions: [
          {
            title: "fatura",
            amount: 300,
            dueDate: "2026-09-12",
            type: "EXPENSE",
            paymentMethod: "Boleto",
          },
        ],
      },
    });

    const result = await importWithAIAction("fatura 300,00 12/09/2026");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactions[0].title).toBe("Fatura");
    }
  });
});

describe("importWithAIAction authentication", () => {
  it("allows an authenticated user to reach the mocked provider", async () => {
    const result = await importWithAIAction("Conta teste 10,00");

    expect(auth.getAuthenticatedIdentity).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(ai.generateObject).toHaveBeenCalled();
  });

  it("rejects anonymous users before calling Groq", async () => {
    auth.getAuthenticatedIdentity.mockResolvedValue(null);

    const result = await importWithAIAction("Conta teste 10,00");

    expect(auth.getAuthenticatedIdentity).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(ai.generateObject).not.toHaveBeenCalled();
  });
});