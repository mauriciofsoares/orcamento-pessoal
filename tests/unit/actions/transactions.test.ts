import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SERIES_ID,
  SERIES_TRANSACTION_IDS,
  TRANSACTION_ID,
  USER_A,
  USER_B,
  makeSeries,
  makeTransaction,
} from "../fixtures";

const auth = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getAuthenticatedIdentity: vi.fn(),
}));

const prisma = vi.hoisted(() => {
  const transaction = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  const client = {
    transaction,
    $transaction: vi.fn(async (operation: unknown) =>
      Array.isArray(operation)
        ? Promise.all(operation)
        : (operation as (value: typeof client) => unknown)(client),
          ),
        };

  return client;
});

vi.mock("@/lib/auth/get-authenticated-user", () => auth);
vi.mock("@/lib/auth/get-authenticated-identity", () => auth);
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createTransactionAction,
  deleteTransactionAction,
  deleteTransactionSeriesAction,
  getProjectionAction,
  getTransactionsAction,
  toggleTransactionPaidStatusAction,
  updateTransactionAction,
} from "@/actions/transactions";

const validInput = {
  title: "Conta nova",
  type: "EXPENSE" as const,
  paymentMethod: "Pix",
  dueDate: "2026-09-10",
  amount: 100,
  isPaid: false,
  recurrence: "SINGLE" as const,
  occurrences: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.getAuthenticatedUser.mockResolvedValue(USER_A);
  auth.getAuthenticatedIdentity.mockResolvedValue(USER_A);
  const row = makeTransaction();
  const series = makeSeries();
  prisma.transaction.findMany.mockResolvedValue([row]);
  prisma.transaction.findFirst.mockImplementation(({ where }: { where: { id: string; userId?: string } }) => {
    const candidate = [row, ...series].find((item) => item.id === where.id);
    if (!candidate || (where.userId && where.userId !== candidate.userId)) return null;
    return candidate;
  });
  prisma.transaction.findMany.mockImplementation(({ where }: { where: { groupId?: string; userId?: string } }) => {
    if (where.groupId === SERIES_ID && where.userId === USER_A.id) return series.slice(1);
    return [row];
  });
  prisma.transaction.findFirstOrThrow.mockResolvedValue(row);
  prisma.transaction.create.mockResolvedValue(row);
  prisma.transaction.update.mockResolvedValue(row);
  prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
  prisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
});

describe("transaction reads", () => {
  it("filters transactions by USER_A", async () => {
    await getTransactionsAction();

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_A.id }) }),
    );
  });

  it("filters transactions by USER_B", async () => {
    auth.getAuthenticatedIdentity.mockResolvedValue(USER_B);

    await getTransactionsAction();

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER_B.id }) }),
    );
  });

  it("rejects anonymous reads before Prisma", async () => {
    auth.getAuthenticatedIdentity.mockResolvedValue(null);

    const result = await getTransactionsAction();

    expect(auth.getAuthenticatedIdentity).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });
});

describe("projection", () => {
  it.each([USER_A, USER_B])("filters projection by %s", async (user) => {
    auth.getAuthenticatedIdentity.mockResolvedValue(user);

    await getProjectionAction(6);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: user.id }) }),
    );
  });

  it("rejects anonymous projection before Prisma", async () => {
    auth.getAuthenticatedIdentity.mockResolvedValue(null);

    const result = await getProjectionAction(6);

    expect(auth.getAuthenticatedIdentity).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });
});

describe("create ownership", () => {
  it("assigns USER_A even when the payload contains USER_B", async () => {
    const result = await createTransactionAction({ ...validInput, userId: USER_B.id });

    expect(result.success).toBe(true);
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_A.id }),
    });
  });

  it("assigns USER_B when USER_B is authenticated", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);

    await createTransactionAction(validInput);

    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_B.id }),
    });
  });

  it("rejects anonymous creation before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await createTransactionAction(validInput);

    expect(result.success).toBe(false);
    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});

describe("IDOR protection", () => {
  it("updates with id and USER_A ownership", async () => {
    await updateTransactionAction(TRANSACTION_ID, { title: "Atualizada" });

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_A.id },
      data: expect.any(Object),
    });
  });

  it("does not update A when B provides A's id", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);

    const result = await updateTransactionAction(TRANSACTION_ID, { title: "Ataque" });

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_B.id },
    });
    expect(result.success).toBe(false);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("rejects anonymous update before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await updateTransactionAction(TRANSACTION_ID, { title: "Bloqueada" });

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("toggles with id and ownership", async () => {
    await toggleTransactionPaidStatusAction(TRANSACTION_ID);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_A.id },
      data: { isPaid: true },
    });
  });

  it("does not toggle A when B provides A's id", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);

    const result = await toggleTransactionPaidStatusAction(TRANSACTION_ID);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_B.id },
      select: { isPaid: true },
    });
    expect(result.success).toBe(false);
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("rejects anonymous toggle before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await toggleTransactionPaidStatusAction(TRANSACTION_ID);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("deletes with id and ownership", async () => {
    await deleteTransactionAction(TRANSACTION_ID);

    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_A.id },
    });
  });

  it("does not delete A when B provides A's id", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);
    prisma.transaction.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteTransactionAction(TRANSACTION_ID);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: { id: TRANSACTION_ID, userId: USER_B.id },
    });
  });

  it("protects series deletion with groupId and ownership", async () => {
    const series = makeSeries();

    await deleteTransactionSeriesAction(SERIES_TRANSACTION_IDS[0]);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: SERIES_TRANSACTION_IDS[0], userId: USER_A.id },
      select: { groupId: true, dueDate: true },
    });
    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
      where: {
        groupId: SERIES_ID,
        userId: USER_A.id,
        dueDate: { gte: series[0].dueDate },
      },
    });
  });

  it("does not delete A's series when B provides A's transaction id", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);

    const result = await deleteTransactionSeriesAction(SERIES_TRANSACTION_IDS[0]);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: SERIES_TRANSACTION_IDS[0], userId: USER_B.id },
      select: { groupId: true, dueDate: true },
    });
    expect(result.success).toBe(false);
    expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
  });

  it("updates only future siblings in the same owned series", async () => {
    const series = makeSeries();

    await updateTransactionAction(SERIES_TRANSACTION_IDS[0], { title: "Atualizada" }, "FUTURE");

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        groupId: SERIES_ID,
        userId: USER_A.id,
        dueDate: { gt: series[0].dueDate },
      },
      select: {
        id: true,
        recurrence: true,
        installmentNumber: true,
        installmentTotal: true,
      },
    });
    expect(prisma.transaction.update).toHaveBeenCalledTimes(2);
  });

  it("does not update A's future siblings when B provides A's id", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(USER_B);

    const result = await updateTransactionAction(SERIES_TRANSACTION_IDS[0], { title: "Ataque" }, "FUTURE");

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: SERIES_TRANSACTION_IDS[0], userId: USER_B.id },
    });
    expect(result.success).toBe(false);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it("rejects anonymous series deletion before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await deleteTransactionSeriesAction(TRANSACTION_ID);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects anonymous mutation before Prisma", async () => {
    auth.getAuthenticatedUser.mockResolvedValue(null);

    const result = await deleteTransactionAction(TRANSACTION_ID);

    expect(auth.getAuthenticatedUser).toHaveBeenCalledOnce();
    expect(result.success).toBe(false);
    expect(prisma.transaction.deleteMany).not.toHaveBeenCalled();
  });
});