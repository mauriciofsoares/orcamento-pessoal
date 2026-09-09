import { getTransactionsAction } from "@/actions/transactions";
import { SummaryCards } from "@/components/SummaryCards";
import { AiImportButton } from "@/components/AiImportButton";
import { ImportSheetButton } from "@/components/ImportSheetButton";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionTable } from "@/components/TransactionTable";
import { MONTH_NAMES } from "@/lib/format";

function parsePeriod(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const now = new Date();

  const month = parsePeriod(params.month, now.getMonth() + 1);
  const year = parsePeriod(params.year, now.getFullYear());

  const result = await getTransactionsAction({ month, year });
  const transactions = result.success ? result.data : [];

  return (
    <main className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
            Orçamento pessoal
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {MONTH_NAMES[month - 1]} de {year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AiImportButton />
          <ImportSheetButton />
          <TransactionForm />
        </div>
      </header>

      {!result.success && (
        <p className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {result.message}
        </p>
      )}

      <div className="space-y-6">
        <SummaryCards transactions={transactions} />
        <TransactionTable
          transactions={transactions}
          month={month}
          year={year}
        />
      </div>
    </main>
  );
}
