"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  transactionFiltersSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@/schemas/transaction";

export type TransactionDTO = {
  id: string;
  title: string;
  type: "INCOME" | "EXPENSE";
  paymentMethod: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  isOverdue: boolean;
  remaining: number;
  groupId: string | null;
  recurrence: "SINGLE" | "INSTALLMENT" | "FIXED";
  installmentNumber: number | null;
  installmentTotal: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors?: Record<string, string[]> };

type TransactionRow = Prisma.TransactionModel;

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function revalidateBudget() {
  revalidatePath("/");
  revalidatePath("/projection");
}

const INSTALLMENT_SUFFIX = /\s*\(\d+\/\d+\)\s*$/;

export type UpdateMode = "SINGLE" | "FUTURE";

// O sufixo "(3/12)" e derivado da parcela, entao nao viaja junto com o titulo editado.
function buildTitle(
  baseTitle: string,
  row: Pick<
    TransactionRow,
    "recurrence" | "installmentNumber" | "installmentTotal"
  >,
) {
  const clean = baseTitle.replace(INSTALLMENT_SUFFIX, "").trim();

  return row.recurrence === "INSTALLMENT" &&
    row.installmentNumber !== null &&
    row.installmentTotal !== null
    ? `${clean} (${row.installmentNumber}/${row.installmentTotal})`
    : clean;
}

// Soma meses preservando o ultimo dia do mes: 31/01 + 1 mes vira 28/02, nao 03/03.
function addMonthsUTC(date: Date, months: number) {
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}

// Decimal e Date não atravessam a fronteira Server -> Client Component.
function toDTO(row: TransactionRow, today: Date): TransactionDTO {
  const amount = Number(row.amount);
  const isOverdue = row.type === "EXPENSE" && !row.isPaid && row.dueDate < today;

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    paymentMethod: row.paymentMethod,
    dueDate: row.dueDate.toISOString(),
    amount,
    isPaid: row.isPaid,
    isOverdue,
    remaining: row.isPaid ? 0 : amount,
    groupId: row.groupId,
    recurrence: row.recurrence,
    installmentNumber: row.installmentNumber,
    installmentTotal: row.installmentTotal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTransactionAction(
  input: unknown,
): Promise<ActionResult<TransactionDTO>> {
  const parsed = transactionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Dados inválidos. Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    title,
    type,
    paymentMethod,
    dueDate,
    amount,
    isPaid,
    recurrence,
    frequency,
    occurrences,
  } = parsed.data;

  const total = recurrence === "SINGLE" ? 1 : occurrences;
  const monthStep = recurrence === "FIXED" && frequency === "YEARLY" ? 12 : 1;
  const groupId = total > 1 ? randomUUID() : null;

  const rows = Array.from({ length: total }, (_, index) => ({
    title:
      recurrence === "INSTALLMENT" ? `${title} (${index + 1}/${total})` : title,
    type,
    paymentMethod,
    dueDate: addMonthsUTC(dueDate, index * monthStep),
    amount: amount.toFixed(2),
    // Só a primeira ocorrência pode nascer paga; as futuras são sempre em aberto.
    isPaid: index === 0 ? isPaid : false,
    groupId,
    recurrence,
    frequency: recurrence === "FIXED" ? frequency : null,
    installmentNumber: recurrence === "INSTALLMENT" ? index + 1 : null,
    installmentTotal: recurrence === "INSTALLMENT" ? total : null,
  }));

  try {
    const [created] = await prisma.$transaction(
      rows.map((data) => prisma.transaction.create({ data })),
    );

    revalidateBudget();
    return { success: true, data: toDTO(created, startOfToday()) };
  } catch {
    return { success: false, message: "Não foi possível salvar o lançamento." };
  }
}

export async function getTransactionsAction(
  filters?: unknown,
): Promise<ActionResult<TransactionDTO[]>> {
  const parsed = transactionFiltersSchema.safeParse(filters ?? {});

  if (!parsed.success) {
    return { success: false, message: "Filtros inválidos." };
  }

  const { month, year, type, isPaid } = parsed.data;
  const where: Prisma.TransactionWhereInput = {};

  if (month && year) {
    where.dueDate = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
  } else if (year) {
    where.dueDate = {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  if (type) where.type = type;
  if (typeof isPaid === "boolean") where.isPaid = isPaid;

  try {
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    const today = startOfToday();
    return { success: true, data: rows.map((row) => toDTO(row, today)) };
  } catch {
    return { success: false, message: "Não foi possível carregar os lançamentos." };
  }
}

export async function updateTransactionAction(
  id: string,
  data: unknown,
  updateMode: UpdateMode = "SINGLE",
): Promise<ActionResult<TransactionDTO>> {
  const parsed = updateTransactionSchema.safeParse({
    ...(data as Record<string, unknown>),
    id,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Dados inválidos. Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { title, type, paymentMethod, dueDate, amount, isPaid } = parsed.data;

  try {
    const current = await prisma.transaction.findUnique({ where: { id } });

    if (!current) {
      return { success: false, message: "Lançamento não encontrado." };
    }

    // Campos que fazem sentido propagar para as ocorrencias futuras da serie.
    const sharedData = {
      ...(type !== undefined && { type }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(amount !== undefined && { amount: amount.toFixed(2) }),
    };

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...sharedData,
        ...(title !== undefined && { title: buildTitle(title, current) }),
        ...(dueDate !== undefined && { dueDate }),
        ...(isPaid !== undefined && { isPaid }),
      },
    });

    if (updateMode === "FUTURE" && current.groupId) {
      const siblings = await prisma.transaction.findMany({
        where: {
          groupId: current.groupId,
          dueDate: { gt: current.dueDate },
        },
        select: { id: true, recurrence: true, installmentNumber: true, installmentTotal: true },
      });

      if (siblings.length > 0) {
        await prisma.$transaction(
          siblings.map((sibling) =>
            prisma.transaction.update({
              where: { id: sibling.id },
              data: {
                ...sharedData,
                // dueDate e isPaid sao proprios de cada ocorrencia e nao se propagam.
                ...(title !== undefined && {
                  title: buildTitle(title, sibling),
                }),
              },
            }),
          ),
        );
      }
    }

    revalidateBudget();
    return { success: true, data: toDTO(updated, startOfToday()) };
  } catch {
    return { success: false, message: "Não foi possível salvar as alterações." };
  }
}

export async function toggleTransactionPaidStatusAction(
  id: string,
): Promise<ActionResult<TransactionDTO>> {
  try {
    const current = await prisma.transaction.findUnique({
      where: { id },
      select: { isPaid: true },
    });

    if (!current) {
      return { success: false, message: "Lançamento não encontrado." };
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { isPaid: !current.isPaid },
    });

    revalidateBudget();
    return { success: true, data: toDTO(updated, startOfToday()) };
  } catch {
    return { success: false, message: "Não foi possível atualizar o status." };
  }
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await prisma.transaction.delete({ where: { id } });
    revalidateBudget();
    return { success: true, data: { id } };
  } catch {
    return { success: false, message: "Não foi possível excluir o lançamento." };
  }}

// Remove as ocorrências futuras da série (a partir da informada), preservando o histórico já vencido.
export async function deleteTransactionSeriesAction(
  id: string,
): Promise<ActionResult<{ deleted: number }>> {
  try {
    const current = await prisma.transaction.findUnique({
      where: { id },
      select: { groupId: true, dueDate: true },
    });

    if (!current) {
      return { success: false, message: "Lançamento não encontrado." };
    }

    if (!current.groupId) {
      await prisma.transaction.delete({ where: { id } });
      revalidateBudget();
      return { success: true, data: { deleted: 1 } };
    }

    const result = await prisma.transaction.deleteMany({
      where: {
        groupId: current.groupId,
        dueDate: { gte: current.dueDate },
      },
    });

    revalidateBudget();
    return { success: true, data: { deleted: result.count } };
  } catch {
    return { success: false, message: "Não foi possível excluir a série." };
  }}
export type MonthProjection = {
  month: number;
  year: number;
  income: number;
  expenses: number;
  paidExpenses: number;
  net: number;
  cumulative: number;
  transactionCount: number;
};

export async function getProjectionAction(
  months: number,
  startingBalance = 0,
): Promise<ActionResult<MonthProjection[]>> {
  const horizon = Math.min(Math.max(Math.trunc(months) || 12, 1), 24);
  const opening = Number.isFinite(startingBalance) ? startingBalance : 0;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = addMonthsUTC(start, horizon);

  try {
    const rows = await prisma.transaction.findMany({
      where: { dueDate: { gte: start, lt: end } },
      select: { dueDate: true, amount: true, type: true, isPaid: true },
    });

    const buckets = new Map<string, MonthProjection>();

    for (let index = 0; index < horizon; index += 1) {
      const cursor = addMonthsUTC(start, index);
      buckets.set(`${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`, {
        month: cursor.getUTCMonth() + 1,
        year: cursor.getUTCFullYear(),
        income: 0,
        expenses: 0,
        paidExpenses: 0,
        net: 0,
        cumulative: 0,
        transactionCount: 0,
      });
    }

    for (const row of rows) {
      const bucket = buckets.get(
        `${row.dueDate.getUTCFullYear()}-${row.dueDate.getUTCMonth()}`,
      );
      if (!bucket) continue;

      const amount = Number(row.amount);
      bucket.transactionCount += 1;

      if (row.type === "INCOME") {
        bucket.income += amount;
      } else {
        bucket.expenses += amount;
        if (row.isPaid) bucket.paidExpenses += amount;
      }
    }

    let running = opening;
    const projection = [...buckets.values()].map((bucket) => {
      bucket.net = bucket.income - bucket.expenses;
      running += bucket.net;
      bucket.cumulative = running;
      return bucket;
    });

    return { success: true, data: projection };
  } catch {
    return { success: false, message: "Não foi possível montar a projeção." };
  }
}