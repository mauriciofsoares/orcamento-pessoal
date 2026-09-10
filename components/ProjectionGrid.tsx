import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MonthProjection } from "@/actions/transactions";
import { MONTH_NAMES, formatCurrency } from "@/lib/format";
import { StartingBalanceInput } from "@/components/StartingBalanceInput";

function commitmentRatio(month: MonthProjection) {
  if (month.income <= 0) return month.expenses > 0 ? 1 : 0;
  return month.expenses / month.income;
}

function barTone(ratio: number) {
  if (ratio === 0) return "bg-[#334155]";
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
      className={`rounded-2xl border bg-[#172033] p-3.5 ${
        isCurrent
          ? "border-[#10B981]"
          : "border-[#334155]"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-outfit text-sm font-semibold text-[#F8FAFC]">
          {MONTH_NAMES[projection.month - 1]}
          <span className="ml-1 text-xs font-normal text-[#F8FAFC]">
            {projection.year}
          </span>
        </h3>
        {isCurrent && (
          <span className="rounded-full border border-[#10B981] bg-[#10B981]/10 px-2 py-0.5 text-[11px] font-medium text-[#10B981]">
            Atual
          </span>
        )}
      </header>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-[#94A3B8]">Comprometido</span>
          <span
            className={`font-medium tabular-nums ${
              ratio > 1 ? "text-[#F87171]" : "text-[#F8FAFC]"
            }`}
          >
            {projection.income > 0 ? `${percent}%` : "sem receita"}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#334155]">
          <div
            className={`h-full rounded-full transition-all ${barTone(ratio)}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-[#94A3B8]">Receitas</dt>
          <dd className="tabular-nums text-[#10B981]">
            {formatCurrency(projection.income)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#94A3B8]">Despesas</dt>
          <dd className="tabular-nums text-[#F87171]">
            {formatCurrency(projection.expenses)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[#334155] pt-1.5">
          <dt className="text-[#94A3B8]">Resultado</dt>
          <dd
            className={`flex items-center gap-1 font-medium tabular-nums ${
              projection.net === 0
                ? "text-[#94A3B8]"
                : isPositive
                  ? "text-[#10B981]"
                  : "text-[#F87171]"
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
          <dt className="text-[#94A3B8]">Acumulado</dt>
          <dd
            className={`tabular-nums ${
              projection.cumulative < 0 ? "text-[#F87171]" : "text-[#F8FAFC]"
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
    <section className="rounded-2xl border border-[#334155] bg-[#172033] p-6 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)]">
      <h2 className="font-outfit text-xl font-semibold text-[#F8FAFC]">
        Saldo acumulado projetado
      </h2>
      <p className="mt-1 text-sm text-[#94A3B8]">
        Como o caixa evolui carregando o resultado de cada mês.
      </p>

      <div className="group/chart mt-6 flex h-[194px] items-end gap-2 overflow-x-auto md:overflow-visible">
        {projections.map((item) => {
          const barHeight = Math.max(
            (Math.abs(item.cumulative) / peak) * 132,
            item.cumulative === 0 ? 2 : 8,
          );
          const isNegative = item.cumulative < 0;

          return (
            <div
              key={`${item.year}-${item.month}`}
              className="group/bar flex min-w-10 flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex h-[170px] w-full items-end justify-center">
                <div
                  className="pointer-events-none absolute left-1/2 z-10 hidden w-max -translate-x-1/2 rounded-lg border border-[#334155] bg-[#172033] px-3 py-2 text-center text-xs shadow-[0_10px_24px_rgba(0,0,0,0.3)] group-hover/bar:block"
                  style={{ bottom: `${barHeight + 36}px` }}
                >
                  <p className="font-semibold text-[#F8FAFC]">
                    {MONTH_NAMES[item.month - 1]} {item.year}
                  </p>
                  <p className={`mt-0.5 font-bold tabular-nums ${isNegative ? "text-[#F87171]" : "text-[#10B981]"}`}>
                    {formatCurrency(item.cumulative)}
                  </p>
                </div>
                <span
                  className={`pointer-events-none absolute left-1/2 z-10 w-max -translate-x-1/2 text-[10px] font-medium tabular-nums sm:text-xs ${
                    isNegative ? "text-[#F87171]/70" : "text-[#10B981]/70"
                  }`}
                    style={{ bottom: `${barHeight + 8}px` }}
                >
                  {formatCurrency(item.cumulative)}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-opacity group-hover/chart:opacity-60 group-hover/bar:!opacity-100 ${
                    isNegative
                      ? "bg-gradient-to-b from-[#F87171] to-[#FB7185]"
                      : "bg-gradient-to-b from-[#10B981] to-[#34D399]"
                  }`}
                  style={{ height: `${barHeight}px` }}
                />
              </div>
              <span className="text-xs uppercase text-[#94A3B8]">
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
        <div className="rounded-2xl border border-[#334155] bg-[#172033] px-4 py-16 text-center">
          <p className="text-sm text-[#94A3B8]">
            Nenhum lançamento futuro cadastrado.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Cadastre despesas fixas ou parceladas para ver a projeção.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StartingBalanceInput value={startingBalance} />
      <CumulativeTimeline projections={projections} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
