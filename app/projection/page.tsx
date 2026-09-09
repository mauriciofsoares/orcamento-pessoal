import { getProjectionAction } from "@/actions/transactions";
import { ProjectionGrid } from "@/components/ProjectionGrid";
import { HorizonFilter } from "@/components/HorizonFilter";
import { formatCurrency } from "@/lib/format";

const HORIZONS = [6, 12, 24];

export default async function ProjectionPage({ searchParams }: PageProps<"/projection">) {
  const params = await searchParams;
  const raw = Number(Array.isArray(params.months) ? params.months[0] : params.months);
  const months = HORIZONS.includes(raw) ? raw : 12;

  const rawBalance = Number(
    Array.isArray(params.balance) ? params.balance[0] : params.balance,
  );
  const startingBalance = Number.isFinite(rawBalance) ? rawBalance : 0;

  const result = await getProjectionAction(months, startingBalance);
  const projections = result.success ? result.data : [];

  const totalIncome = projections.reduce((sum, item) => sum + item.income, 0);
  const totalExpenses = projections.reduce((sum, item) => sum + item.expenses, 0);
  const finalBalance = projections.at(-1)?.cumulative ?? 0;
  const worstMonth = projections.reduce<(typeof projections)[number] | null>(
    (worst, item) => (worst === null || item.net < worst.net ? item : worst),
    null,
  );

  return (
    <main className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-100">Projeção</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Próximos {months} meses a partir do mês atual
          </p>
        </div>
        <HorizonFilter months={months} options={HORIZONS} />
      </header>

      {!result.success && (
        <p className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {result.message}
        </p>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Receitas previstas
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-400">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Despesas previstas
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-rose-400">
            {formatCurrency(totalExpenses)}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-5 ${
            finalBalance < 0
              ? "border-rose-500/30 bg-rose-500/10"
              : "border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Saldo ao fim do período
          </p>
          <p
            className={`mt-2 text-xl font-semibold tabular-nums ${
              finalBalance < 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-500 dark:text-emerald-400"
            }`}
          >
            {formatCurrency(finalBalance)}
          </p>
          {worstMonth && worstMonth.net < 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Mês mais apertado: {worstMonth.month}/{worstMonth.year} (
              {formatCurrency(worstMonth.net)})
            </p>
          )}
        </div>
      </section>

      <ProjectionGrid
        projections={projections}
        startingBalance={startingBalance}
      />
    </main>
  );
}
