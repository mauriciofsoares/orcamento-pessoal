import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MonthProjection } from "@/actions/transactions";
import { MONTH_NAMES, formatCurrency } from "@/lib/format";
import { StartingBalanceInput } from "@/components/StartingBalanceInput";

function commitmentRatio(month: MonthProjection) {
  if (month.income <= 0) return month.expenses > 0 ? 1 : 0;
  return month.expenses / month.income;
}

function barTone(ratio: number) {
  if (ratio === 0) return "bg-slate-300 dark:bg-slate-700";
  if (ratio <= 0.7) return "bg-emerald-500";
  if (ratio <= 1) return "bg-amber-500";
  return "bg-rose-500";
}

function MonthCard({
  projection,
  isCurrent,
}: {
  projection: MonthProjection;
  isCurrent: boolean;
}) {
  const ratio = commitmentRatio(projection);
  const percent = Math.round(ratio * 100);
  const isPositive = projection.net >= 0;

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${
        isCurrent
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
          {MONTH_NAMES[projection.month - 1]}
          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-500">
            {projection.year}
          </span>
        </h3>
        {isCurrent && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            Atual
          </span>
        )}
      </header>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-500">Comprometido</span>
          <span
            className={`font-medium tabular-nums ${
              ratio > 1 ? "text-rose-500 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {projection.income > 0 ? `${percent}%` : "sem receita"}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${barTone(ratio)}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-500 dark:text-slate-500">Receitas</dt>
          <dd className="tabular-nums text-emerald-400">
            {formatCurrency(projection.income)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500 dark:text-slate-500">Despesas</dt>
          <dd className="tabular-nums text-rose-400">
            {formatCurrency(projection.expenses)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-1.5 dark:border-slate-800">
          <dt className="text-slate-600 dark:text-slate-400">Resultado</dt>
          <dd
            className={`flex items-center gap-1 font-medium tabular-nums ${
              projection.net === 0
                ? "text-slate-500 dark:text-slate-400"
                : isPositive
                  ? "text-emerald-400"
                  : "text-rose-400"
            }`}
          >
            {projection.net === 0 ? (
              <Minus className="size-3" aria-hidden />
            ) : isPositive ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden />
            )}
            {formatCurrency(projection.net)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500 dark:text-slate-500">Acumulado</dt>
          <dd
            className={`tabular-nums ${
              projection.cumulative < 0 ? "text-rose-600 dark:text-rose-300" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {formatCurrency(projection.cumulative)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function CumulativeTimeline({
  projections,
}: {
  projections: MonthProjection[];
}) {
  // Escala simétrica em torno do zero para positivos e negativos ficarem comparáveis.
  const peak = Math.max(
    ...projections.map((item) => Math.abs(item.cumulative)),
    1,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
        Saldo acumulado projetado
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
        Como o caixa evolui carregando o resultado de cada mês.
      </p>

      <div className="mt-6 flex items-end gap-1.5 overflow-x-auto pb-2">
        {projections.map((item) => {
          const height = Math.max(
            (Math.abs(item.cumulative) / peak) * 100,
            item.cumulative === 0 ? 2 : 6,
          );
          const isNegative = item.cumulative < 0;

          return (
            <div
              key={`${item.year}-${item.month}`}
              className="flex min-w-10 flex-1 flex-col items-center gap-1.5"
              title={`${MONTH_NAMES[item.month - 1]}/${item.year}: ${formatCurrency(item.cumulative)}`}
            >
              <div className="flex h-32 w-full items-end justify-center">
                <div
                  className={`w-full rounded-t transition-all ${
                    isNegative ? "bg-rose-500/70" : "bg-emerald-500/70"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[10px] uppercase text-slate-500 dark:text-slate-500">
                {MONTH_NAMES[item.month - 1].slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProjectionGrid({
  projections,
  startingBalance,
}: {
  projections: MonthProjection[];
  startingBalance: number;
}) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (projections.every((item) => item.transactionCount === 0)) {
    return (
      <div className="space-y-6">
        <StartingBalanceInput value={startingBalance} />
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nenhum lançamento futuro cadastrado.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">
            Cadastre despesas fixas ou parceladas para ver a projeção.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StartingBalanceInput value={startingBalance} />
      <CumulativeTimeline projections={projections} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projections.map((projection) => (
          <MonthCard
            key={`${projection.year}-${projection.month}`}
            projection={projection}
            isCurrent={
              projection.month === currentMonth && projection.year === currentYear
            }
          />
        ))}
      </div>
    </div>
  );
}
