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
    <main className="w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8 md:min-h-0 md:flex-1 md:overflow-y-auto md:[scrollbar-color:#475569_#172033] md:[scrollbar-width:thin] md:[&::-webkit-scrollbar]:w-2 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-[#475569] md:[&::-webkit-scrollbar-thumb:hover]:bg-[#64748B] md:[&::-webkit-scrollbar-track]:bg-[#172033]">
      <header className="mb-6 flex flex-col gap-[18px] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-outfit text-3xl font-bold text-[#F8FAFC] sm:text-[40px]">Projeção</h1>
          <p className="mt-1 text-sm leading-[1.4] text-[#94A3B8]">
            Próximos {months} meses a partir do mês atual
          </p>
        </div>
        <HorizonFilter months={months} options={HORIZONS} />
      </header>

      {!result.success && (
        <p className="mb-6 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {result.message}
        </p>
      )}

      <section className="mb-4 grid grid-cols-1 gap-2.5 sm:gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#334155] bg-[#172033] p-4 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:min-h-[120px] sm:p-5">
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8] sm:text-xs">
            Receitas previstas
          </p>
          <p className="mt-2 font-outfit text-2xl font-bold tabular-nums text-[#34D399] sm:text-[26px]">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#334155] bg-[#172033] p-4 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:min-h-[120px] sm:p-5">
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8] sm:text-xs">
            Despesas previstas
          </p>
          <p className="mt-2 font-outfit text-2xl font-bold tabular-nums text-[#F87171] sm:text-[26px]">
            {formatCurrency(totalExpenses)}
          </p>
        </div>
        <div
          className="rounded-2xl border border-[#334155] bg-[#172033] p-4 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:min-h-[120px] sm:p-5"
        >
          <p className="text-[10px] font-semibold uppercase text-[#94A3B8] sm:text-xs">
            Saldo ao fim do período
          </p>
          <p
            className={`mt-2 font-outfit text-2xl font-bold tabular-nums sm:text-[26px] ${
              finalBalance < 0 ? "text-[#F87171]" : "text-[#34D399]"
            }`}
          >
            {formatCurrency(finalBalance)}
          </p>
          {worstMonth && worstMonth.net < 0 && (
            <p className="mt-2 text-[11px] text-[#94A3B8] sm:text-xs">
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
