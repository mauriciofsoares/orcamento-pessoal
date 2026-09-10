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
    card: "border-[#334155] bg-[#1E293B]",
    icon: "bg-[#F87171]/10 text-[#F87171]",
    value: "text-[#F87171]",
  },
  danger: {
    card: "border-[#334155] bg-[#1E293B]",
    icon: "bg-[#F8FAFC]/10 text-[#F8FAFC]",
    value: "text-[#F8FAFC]",
  },
  warning: {
    card: "border-[#334155] bg-[#1E293B]",
    icon: "bg-[#FBBF24]/10 text-[#FBBF24]",
    value: "text-[#FBBF24]",
  },
  critical: {
    card: "border-[#334155] bg-[#1E293B]",
    icon: "bg-[#F87171]/10 text-[#F87171]",
    value: "text-[#F87171]",
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
    <div className={`min-h-[140px] rounded-2xl border p-5 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[#94A3B8]">
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
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-xs text-[#64748B]">{hint}</p>
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
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryCard
        label="Saldo atual"
        value={balance}
        valueClassName={balance < 0 ? "text-[#F87171]" : "text-[#10B981]"}
        hint={`${formatCurrency(paidExpenses)} em despesas pagas`}
        icon={Wallet}
        tone="neutral"
      />
      <SummaryCard
        label="Saldo previsto"
        value={projectedBalance}
        valueClassName={
          projectedBalance < 0 ? "text-[#F87171]" : "text-[#10B981]"
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
