import {
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TransactionDTO } from "@/actions/transactions";
import { formatCurrency } from "@/lib/format";

type Tone = "neutral" | "danger" | "warning" | "critical";

const TONE_STYLES: Record<Tone, { card: string; icon: string; value: string }> = {
  neutral: {
    card: "border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none",
    icon: "bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-400",
  },
  danger: {
    card: "border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none",
    icon: "bg-rose-500/10 text-rose-400",
    value: "text-slate-950 dark:text-slate-100",
  },
  warning: {
    card: "border-amber-500/30 bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-400",
    value: "text-amber-300",
  },
  critical: {
    card: "border-rose-500/30 bg-rose-500/10",
    icon: "bg-rose-500/15 text-rose-400",
    value: "text-rose-300",
  },
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  valueClassName,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  valueClassName?: string;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p
            className={`mt-2 break-words text-2xl font-semibold tabular-nums leading-tight ${
              valueClassName ?? styles.value
            }`}
          >
            {formatCurrency(value)}
          </p>
        </div>
        <span className={`rounded-xl p-2.5 ${styles.icon}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">{hint}</p>
    </div>
  );
}

export function SummaryCards({
  transactions,
}: {
  transactions: TransactionDTO[];
}) {
  const expenses = transactions.filter((item) => item.type === "EXPENSE");
  const incomes = transactions.filter((item) => item.type === "INCOME");

  const receivedIncome = transactions
    .filter((item) => item.type === "INCOME" && item.isPaid)
    .reduce((total, item) => total + item.amount, 0);

  const totalIncome = incomes.reduce((total, item) => total + item.amount, 0);

  const totalExpenses = expenses.reduce((total, item) => total + item.amount, 0);

  const paidExpenses = expenses
    .filter((item) => item.isPaid)
    .reduce((total, item) => total + item.amount, 0);

  const remaining = expenses
    .filter((item) => !item.isPaid)
    .reduce((total, item) => total + item.amount, 0);

  const overdue = expenses
    .filter((item) => item.isOverdue)
    .reduce((total, item) => total + item.amount, 0);

  const paidCount = expenses.filter((item) => item.isPaid).length;
  const overdueCount = expenses.filter((item) => item.isOverdue).length;
  const balance = receivedIncome - paidExpenses;
  const projectedBalance = totalIncome - totalExpenses;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <SummaryCard
        label="Saldo atual"
        value={balance}
        valueClassName={balance < 0 ? "text-rose-400" : "text-emerald-400"}
        hint={`${formatCurrency(paidExpenses)} em despesas pagas`}
        icon={Wallet}
        tone="neutral"
      />
      <SummaryCard
        label="Saldo previsto"
        value={projectedBalance}
        valueClassName={
          projectedBalance < 0 ? "text-rose-400" : "text-emerald-400"
        }
        hint={`${formatCurrency(totalIncome)} em entradas no mês`}
        icon={TrendingUp}
        tone="neutral"
      />
      <SummaryCard
        label="Total de despesas"
        value={totalExpenses}
        hint={`${expenses.length} lançamento(s), ${paidCount} pago(s)`}
        icon={TrendingDown}
        tone="danger"
      />
      <SummaryCard
        label="Falta pagar"
        value={remaining}
        hint={`${expenses.length - paidCount} conta(s) em aberto`}
        icon={Clock}
        tone="warning"
      />
      <SummaryCard
        label="Atrasado"
        value={overdue}
        hint={
          overdueCount > 0
            ? `${overdueCount} conta(s) vencida(s)`
            : "Nenhuma conta vencida"
        }
        icon={AlertTriangle}
        tone={overdue > 0 ? "critical" : "danger"}
      />
    </section>
  );
}
