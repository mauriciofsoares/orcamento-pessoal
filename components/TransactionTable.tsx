"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Circle,
  Inbox,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import {
  deleteTransactionAction,
  deleteTransactionSeriesAction,
  toggleTransactionPaidStatusAction,
  type TransactionDTO,
} from "@/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { MonthFilter } from "@/components/MonthFilter";
import { ConfirmModal, type ConfirmAction } from "@/components/ConfirmModal";
import { TransactionForm } from "@/components/TransactionForm";

function StatusBadge({ transaction }: { transaction: TransactionDTO }) {
  if (transaction.isPaid) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        Pago
      </span>
    );
  }

  if (transaction.isOverdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400">
        Atrasado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
      Pendente
    </span>
  );
}

function TypeBadge({ type }: { type: TransactionDTO["type"] }) {
  const isIncome = type === "INCOME";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isIncome
          ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-500 dark:text-rose-400"
      }`}
    >
      {isIncome ? "Receita" : "Despesa"}
    </span>
  );
}

function RecurrenceBadge({ transaction }: { transaction: TransactionDTO }) {
  if (
    transaction.recurrence === "INSTALLMENT" &&
    transaction.installmentTotal !== null
  ) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {transaction.installmentNumber}/{transaction.installmentTotal}
      </span>
    );
  }

  if (transaction.recurrence === "FIXED") {
    return (
      <span
        className="inline-flex items-center rounded-full bg-slate-100 p-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        title="Despesa fixa recorrente"
      >
        <Repeat className="size-3" aria-hidden />
      </span>
    );
  }

  return null;
}

function TransactionActions({
  transaction,
  onRequestDelete,
  onRequestEdit,
  isBusy,
  mobile = false,
}: {
  transaction: TransactionDTO;
  onRequestDelete: (transaction: TransactionDTO) => void;
  onRequestEdit: (transaction: TransactionDTO) => void;
  isBusy: boolean;
  mobile?: boolean;
}) {
  function handleToggle() {
    startTransition(async () => {
      const result = await toggleTransactionPaidStatusAction(transaction.id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(
        result.data.isPaid
          ? `"${result.data.title}" marcado como pago`
          : `"${result.data.title}" voltou para pendente`,
      );
    });
  }

  const [isPending, startTransition] = useTransition();
  const disabled = isBusy || isPending;

  return (
    <div
      className={
        mobile
          ? "grid grid-cols-3 gap-2"
          : "flex items-center justify-end gap-1"
      }
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={transaction.isPaid ? "Marcar como pendente" : "Marcar como pago"}
        aria-pressed={transaction.isPaid}
        className={`flex items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed ${
          mobile ? "min-h-11 gap-2 px-3 py-2 text-xs font-medium" : "size-8"
        } ${
          transaction.isPaid
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 dark:text-emerald-400"
            : "border-slate-300 text-slate-500 hover:border-emerald-500/40 hover:text-emerald-500 dark:border-slate-700 dark:hover:text-emerald-400"
        }`}
      >
        {transaction.isPaid ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Circle className="size-4" aria-hidden />
        )}
        {mobile && <span>{transaction.isPaid ? "Reabrir" : "Pagar"}</span>}
      </button>
      <button
        type="button"
        onClick={() => onRequestEdit(transaction)}
        disabled={disabled}
        title="Editar lançamento"
        className={`flex items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200 ${
          mobile ? "min-h-11 gap-2 px-3 py-2 text-xs font-medium" : "size-8"
        }`}
      >
        <Pencil className="size-4" aria-hidden />
        {mobile && <span>Editar</span>}
      </button>
      <button
        type="button"
        onClick={() => onRequestDelete(transaction)}
        disabled={disabled}
        title="Excluir lançamento"
        className={`flex items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition-colors hover:border-rose-500/40 hover:text-rose-500 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:text-rose-400 ${
          mobile ? "min-h-11 gap-2 px-3 py-2 text-xs font-medium" : "size-8"
        }`}
      >
        <Trash2 className="size-4" aria-hidden />
        {mobile && <span>Excluir</span>}
      </button>
    </div>
  );
}

function TransactionRow({
  transaction,
  onRequestDelete,
  onRequestEdit,
  isDeleting,
}: {
  transaction: TransactionDTO;
  onRequestDelete: (transaction: TransactionDTO) => void;
  onRequestEdit: (transaction: TransactionDTO) => void;
  isDeleting: boolean;
}) {
  const isIncome = transaction.type === "INCOME";
  const TypeIcon = isIncome ? ArrowUpCircle : ArrowDownCircle;
  const isBusy = isDeleting;

  return (
    <tr
      className={`border-t border-[#334155] transition-colors hover:bg-[#172033] ${
        isBusy ? "opacity-50" : ""
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TypeIcon
            className={`size-5 shrink-0 ${
              isIncome ? "text-emerald-400" : "text-rose-400"
            }`}
            aria-label={isIncome ? "Receita" : "Despesa"}
          />
          <p
            className={`truncate font-medium ${
              transaction.isPaid
                ? "text-[#64748B] line-through"
                : "text-[#F8FAFC]"
            }`}
          >
            {transaction.title}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#94A3B8]">
        <div className="flex items-center gap-2">
          <span>{transaction.paymentMethod}</span>
          <RecurrenceBadge transaction={transaction} />
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-[#94A3B8]">
        {formatDate(transaction.dueDate)}
      </td>
      <td
        className={`px-4 py-3 text-right font-medium tabular-nums ${
          transaction.isPaid
            ? "text-[#64748B] line-through"
            : isIncome
              ? "text-emerald-400"
              : "text-[#F8FAFC]"
        }`}
      >
        {formatCurrency(transaction.amount)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge transaction={transaction} />
      </td>
      <td className="px-4 py-3">
        <TransactionActions
          transaction={transaction}
          onRequestDelete={onRequestDelete}
          onRequestEdit={onRequestEdit}
          isBusy={isBusy}
        />
      </td>
    </tr>
  );
}

function TransactionCard({
  transaction,
  onRequestDelete,
  onRequestEdit,
  isDeleting,
}: {
  transaction: TransactionDTO;
  onRequestDelete: (transaction: TransactionDTO) => void;
  onRequestEdit: (transaction: TransactionDTO) => void;
  isDeleting: boolean;
}) {
  const isIncome = transaction.type === "INCOME";
  const TypeIcon = isIncome ? ArrowUpCircle : ArrowDownCircle;

  return (
    <article
      className={`rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 ${
        isDeleting ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TypeIcon
              className={`size-5 shrink-0 ${
                isIncome ? "text-emerald-400" : "text-rose-400"
              }`}
              aria-label={isIncome ? "Receita" : "Despesa"}
            />
            <h3
              className={`min-w-0 break-words text-sm font-semibold ${
                transaction.isPaid
                  ? "text-slate-500 line-through"
                  : "text-slate-950 dark:text-slate-100"
              }`}
            >
              {transaction.title}
            </h3>
            <RecurrenceBadge transaction={transaction} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypeBadge type={transaction.type} />
            <StatusBadge transaction={transaction} />
          </div>
        </div>
        <p
          className={`shrink-0 text-right text-base font-semibold tabular-nums ${
            transaction.isPaid
              ? "text-slate-500 line-through opacity-80"
              : isIncome
                ? "text-emerald-400"
                : "text-slate-950 dark:text-slate-100"
          }`}
        >
          {formatCurrency(transaction.amount)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Método</dt>
          <dd className="mt-1 font-medium text-slate-700 dark:text-slate-300">
            {transaction.paymentMethod}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-500">Vencimento</dt>
          <dd className="mt-1 font-medium tabular-nums text-slate-700 dark:text-slate-300">
            {formatDate(transaction.dueDate)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
        <TransactionActions
          transaction={transaction}
          onRequestDelete={onRequestDelete}
          onRequestEdit={onRequestEdit}
          isBusy={isDeleting}
          mobile
        />
      </div>
    </article>
  );
}

export function TransactionTable({
  transactions,
  month,
  year,
}: {
  transactions: TransactionDTO[];
  month: number;
  year: number;
}) {
  const [target, setTarget] = useState<TransactionDTO | null>(null);
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSeries = target?.groupId !== null && target !== null;

  function runDelete(mode: "single" | "series") {
    if (!target) return;
    const { id, title } = target;

    startTransition(async () => {
      const result =
        mode === "series"
          ? await deleteTransactionSeriesAction(id)
          : await deleteTransactionAction(id);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      setTarget(null);
      toast.success(
        mode === "series" && "deleted" in result.data
          ? `${result.data.deleted} lançamento(s) excluído(s)`
          : `"${title}" excluído`,
      );
    });
  }

  const actions: ConfirmAction[] = isSeries
    ? [
        {
          label: "Somente esta",
          tone: "neutral",
          onClick: () => runDelete("single"),
        },
        { label: "Esta e as próximas", onClick: () => runDelete("series") },
      ]
    : [{ label: "Excluir", onClick: () => runDelete("single") }];

  return (
    <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#1E293B] md:flex md:min-h-0 md:flex-1 md:flex-col">
      <header className="flex shrink-0 flex-col gap-3 border-b border-[#334155] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-outfit text-xl font-semibold text-[#F8FAFC]">Lançamentos</h2>
          <p className="text-xs text-[#64748B]">
            {transactions.length} registro(s) no período
          </p>
        </div>
        <MonthFilter month={month} year={year} />
      </header>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Inbox className="size-8 text-slate-300 dark:text-slate-700" aria-hidden />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nenhum lançamento neste período.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            Use o botão &ldquo;Novo lançamento&rdquo; para começar.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 p-3 md:hidden">
            {transactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onRequestDelete={setTarget}
                onRequestEdit={setEditing}
                isDeleting={isPending && target?.id === transaction.id}
              />
            ))}
          </div>

          <div className="hidden min-h-0 flex-1 overflow-auto [scrollbar-color:#475569_#172033] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#475569] [&::-webkit-scrollbar-thumb:hover]:bg-[#64748B] [&::-webkit-scrollbar-track]:bg-[#172033] md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-[#334155] bg-[#1E293B] text-xs font-semibold uppercase text-[#64748B]">
                <th className="px-5 py-3.5 font-semibold">Título</th>
                <th className="px-5 py-3.5 font-semibold">Método</th>
                <th className="px-5 py-3.5 font-semibold">Vencimento</th>
                <th className="px-5 py-3.5 text-right font-semibold">Valor</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onRequestDelete={setTarget}
                  onRequestEdit={setEditing}
                  isDeleting={isPending && target?.id === transaction.id}
                />
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* key remonta o form para o defaultValues refletir a linha escolhida */}
      {editing && (
        <TransactionForm
          key={editing.id}
          initialData={editing}
          open
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmModal
        open={target !== null}
        title="Excluir lançamento"
        isPending={isPending}
        onClose={() => setTarget(null)}
        actions={actions}
        description={
          isSeries ? (
            <>
              <strong className="text-slate-900 dark:text-slate-200">{target?.title}</strong> faz
              parte de uma série. Você pode excluir apenas esta ocorrência ou
              esta e todas as futuras.
            </>
          ) : (
            <>
              Esta ação não pode ser desfeita.{" "}
              <strong className="text-slate-900 dark:text-slate-200">{target?.title}</strong> será
              removido permanentemente.
            </>
          )
        }
      />
    </section>
  );
}
