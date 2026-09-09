import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import {
  SERIES_TRANSACTION_IDS,
  USER_A,
  USER_B,
} from "../unit/fixtures";
import { createIntegrationPrisma } from "./prisma";
import { getTestDatabaseUrl } from "./database-guard";

const auth = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn() }));
const ai = vi.hoisted(() => ({ generateObject: vi.fn() }));
const state = vi.hoisted(() => ({ prisma: null as ReturnType<typeof createIntegrationPrisma> | null }));

vi.mock("@/lib/auth/get-authenticated-user", () => auth);
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    if (!state.prisma) throw new Error("Integration Prisma is not initialized.");
    return state.prisma;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("ai", () => ai);
vi.mock("@ai-sdk/groq", () => ({ groq: vi.fn(() => ({ mocked: true })) }));

import {
  createTransactionAction,
  deleteTransactionAction,
  deleteTransactionSeriesAction,
  getProjectionAction,
  getTransactionsAction,
  toggleTransactionPaidStatusAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { importTransactionsAction } from "@/actions/import";
import { importWithAIAction, saveAiTransactionsAction } from "@/actions/ai-import";

const BASE_DATE = new Date("2026-09-10T12:00:00.000Z");

function transactionData(userId: string, id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId,
    title: `${userId === USER_A.id ? "A" : "B"} transaction`,
    type: "EXPENSE" as const,
    paymentMethod: "Pix",
    dueDate: BASE_DATE,
    amount: "100.00",
    isPaid: false,
    groupId: null,
    recurrence: "SINGLE" as const,
    frequency: null,
    installmentNumber: null,
    installmentTotal: null,
    ...overrides,
  };
}

async function seedUsers() {
  await state.prisma!.user.createMany({
    data: [
      { id: USER_A.id, email: USER_A.email, name: USER_A.name },
      { id: USER_B.id, email: USER_B.email, name: USER_B.name },
    ],
  });
}

async function seedBaseTransactions() {
  await state.prisma!.transaction.createMany({
    data: [
      transactionData(USER_A.id, "10000000-0000-4000-8000-000000000001"),
      transactionData(USER_A.id, "10000000-0000-4000-8000-000000000002", {
        title: "A receita",
        type: "INCOME",
        amount: "250.00",
      }),
      transactionData(USER_B.id, "10000000-0000-4000-8000-000000000003"),
      transactionData(USER_B.id, "10000000-0000-4000-8000-000000000004", {
        title: "B receita",
        type: "INCOME",
        amount: "400.00",
      }),
    ],
  });

  await state.prisma!.transaction.createMany({
    data: SERIES_TRANSACTION_IDS.map((id, index) =>
      transactionData(USER_A.id, id, {
        title: `A parcela ${index + 1}`,
        groupId: "20000000-0000-4000-8000-000000000001",
        recurrence: "INSTALLMENT",
        installmentNumber: index + 1,
        installmentTotal: 3,
        dueDate: new Date(`2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`),
      }),
    ),
  });

  await state.prisma!.transaction.createMany({
    data: [1, 2, 3].map((index) =>
      transactionData(USER_B.id, `30000000-0000-4000-8000-00000000000${index}`, {
        title: `B parcela ${index}`,
        groupId: "30000000-0000-4000-8000-000000000001",
        recurrence: "INSTALLMENT",
        installmentNumber: index,
        installmentTotal: 3,
        dueDate: new Date(`2026-09-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`),
      }),
    ),
  });
}

async function cleanup() {
  await state.prisma!.transaction.deleteMany({});
  await state.prisma!.user.deleteMany({});
}

function asUser(user: typeof USER_A | typeof USER_B | null) {
  auth.getAuthenticatedUser.mockResolvedValue(user);
}

function makeImportFormData() {
  const formData = new FormData();
  formData.append(
    "file",
    new File(
      [
        "Divida,Forma,Vencimento,Valor\n" +
          "Importada 1,Pix,2026-09-20,10.00\n" +
          "Importada 2,Boleto,2026-09-21,20.00\n" +
          "Importada 3,Pix,2026-09-22,30.00",
      ],
      "integration.csv",
      { type: "text/csv" },
    ),
  );
  return formData;
}

beforeAll(() => {
  getTestDatabaseUrl();
  state.prisma = createIntegrationPrisma();
});

beforeEach(async () => {
  if (!state.prisma) throw new Error("Integration Prisma is not initialized.");
  await cleanup();
  await seedUsers();
  await seedBaseTransactions();
  asUser(USER_A);
  ai.generateObject.mockResolvedValue({
    object: {
      transactions: [
        {
          title: "AI integration",
          amount: 15,
          dueDate: "2026-09-25",
          type: "EXPENSE",
          paymentMethod: "Pix",
        },
      ],
    },
  });
});

afterAll(async () => {
  if (!state.prisma) return;
  await cleanup();
  await state.prisma.$disconnect();
});

describe("transaction integration ownership", () => {
  it("creates for A and ignores a malicious payload owner", async () => {
    const result = await createTransactionAction({
      title: "Criada por A",
      type: "EXPENSE",
      paymentMethod: "Pix",
      dueDate: "2026-09-15",
      amount: 50,
      isPaid: false,
      recurrence: "SINGLE",
      occurrences: 1,
      userId: USER_B.id,
    });

    expect(result.success).toBe(true);
    const created = await state.prisma!.transaction.findFirst({
      where: { title: "Criada por A" },
    });
    expect(created?.userId).toBe(USER_A.id);
  });

  it("reads only the authenticated user's transactions", async () => {
    asUser(USER_A);
    const a = await getTransactionsAction();
    asUser(USER_B);
    const b = await getTransactionsAction();

    expect(a.success && a.data.every((row) => row.id !== "10000000-0000-4000-8000-000000000003")).toBe(true);
    expect(b.success && b.data.every((row) => row.id !== "10000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("prevents cross-user update and preserves B", async () => {
    const before = await state.prisma!.transaction.findUnique({
      where: { id: "10000000-0000-4000-8000-000000000003" },
    });
    asUser(USER_A);

    const result = await updateTransactionAction(
      "10000000-0000-4000-8000-000000000003",
      { title: "Ataque" },
    );

    const after = await state.prisma!.transaction.findUnique({
      where: { id: "10000000-0000-4000-8000-000000000003" },
    });
    expect(result.success).toBe(false);
    expect(after).toEqual(before);
  });

  it("prevents cross-user toggle and preserves B isPaid", async () => {
    asUser(USER_A);
    const result = await toggleTransactionPaidStatusAction(
      "10000000-0000-4000-8000-000000000003",
    );
    const after = await state.prisma!.transaction.findUnique({
      where: { id: "10000000-0000-4000-8000-000000000003" },
    });

    expect(result.success).toBe(false);
    expect(after?.isPaid).toBe(false);
  });

  it("prevents cross-user delete and keeps B", async () => {
    asUser(USER_A);
    const result = await deleteTransactionAction(
      "10000000-0000-4000-8000-000000000003",
    );
    const count = await state.prisma!.transaction.count({
      where: { id: "10000000-0000-4000-8000-000000000003" },
    });

    expect(result.success).toBe(false);
    expect(count).toBe(1);
  });

  it("protects series deletion and future update across users", async () => {
    asUser(USER_A);
    const deleteResult = await deleteTransactionSeriesAction(
      "30000000-0000-4000-8000-000000000001",
    );
    const bSeriesCount = await state.prisma!.transaction.count({
      where: { groupId: "30000000-0000-4000-8000-000000000001" },
    });

    const updateResult = await updateTransactionAction(
      "30000000-0000-4000-8000-000000000001",
      { title: "Ataque futuro" },
      "FUTURE",
    );
    const bSeries = await state.prisma!.transaction.findMany({
      where: { groupId: "30000000-0000-4000-8000-000000000001" },
      orderBy: { installmentNumber: "asc" },
    });

    expect(deleteResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
    expect(bSeriesCount).toBe(3);
    expect(bSeries.every((row) => row.title.startsWith("B parcela"))).toBe(true);
  });

  it("projects only the authenticated user's data", async () => {
    asUser(USER_A);
    const a = await getProjectionAction(6);
    asUser(USER_B);
    const b = await getProjectionAction(6);

    if (!a.success || !b.success) throw new Error("Projection failed in integration test.");
    expect(a.data.reduce((sum, month) => sum + month.income, 0)).toBe(250);
    expect(b.data.reduce((sum, month) => sum + month.income, 0)).toBe(400);
  });

  it("rejects anonymous transaction operations without creating data", async () => {
    const before = await state.prisma!.transaction.count();
    asUser(null);
    const result = await createTransactionAction({
      title: "Anônima",
      type: "EXPENSE",
      paymentMethod: "Pix",
      dueDate: "2026-09-15",
      amount: 50,
      isPaid: false,
      recurrence: "SINGLE",
      occurrences: 1,
    });
    const after = await state.prisma!.transaction.count();

    expect(result.success).toBe(false);
    expect(after).toBe(before);
  });
});

describe("import integration ownership", () => {
  it("imports every row for A", async () => {
    asUser(USER_A);
    const result = await importTransactionsAction(makeImportFormData());
    const imported = await state.prisma!.transaction.findMany({
      where: { title: { startsWith: "Importada" } },
    });

    expect(result.success).toBe(true);
    expect(imported).toHaveLength(3);
    expect(imported.every((row) => row.userId === USER_A.id)).toBe(true);
  });

  it("imports every row for B separately", async () => {
    asUser(USER_B);
    const result = await importTransactionsAction(makeImportFormData());
    const imported = await state.prisma!.transaction.findMany({
      where: { title: { startsWith: "Importada" } },
    });

    expect(result.success).toBe(true);
    expect(imported).toHaveLength(3);
    expect(imported.every((row) => row.userId === USER_B.id)).toBe(true);
  });
});

describe("AI integration ownership", () => {
  it("rejects anonymous AI extraction before calling Groq", async () => {
    asUser(null);
    const result = await importWithAIAction("AI anonymous");

    expect(result.success).toBe(false);
  });

  it("saves AI rows for A and B with database ownership", async () => {
    asUser(USER_A);
    const a = await saveAiTransactionsAction([
      { title: "AI A", amount: 15, dueDate: "2026-09-25", type: "EXPENSE", paymentMethod: "Pix" },
    ]);
    asUser(USER_B);
    const b = await saveAiTransactionsAction([
      { title: "AI B", amount: 15, dueDate: "2026-09-25", type: "EXPENSE", paymentMethod: "Pix" },
    ]);

    const rows = await state.prisma!.transaction.findMany({
      where: { title: { startsWith: "AI " } },
    });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(rows.find((row) => row.title === "AI A")?.userId).toBe(USER_A.id);
    expect(rows.find((row) => row.title === "AI B")?.userId).toBe(USER_B.id);
  });

  it("rejects anonymous AI save without creating a row", async () => {
    const before = await state.prisma!.transaction.count();
    asUser(null);
    const result = await saveAiTransactionsAction([
      { title: "AI anonymous", amount: 15, dueDate: "2026-09-25", type: "EXPENSE", paymentMethod: "Pix" },
    ]);
    const after = await state.prisma!.transaction.count();

    expect(result.success).toBe(false);
    expect(after).toBe(before);
  });
});
