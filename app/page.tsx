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
    <main className="w-full px-4 py-7 sm:px-8 md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden lg:px-10">
      <header className="mb-6 flex shrink-0 flex-col gap-5 lg:mb-7 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-outfit text-[30px] font-bold text-[#F8FAFC] sm:text-[40px]">
            Orçamento pessoal
          </h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {MONTH_NAMES[month - 1]} de {year}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:gap-3 lg:justify-end">
          <AiImportButton />
          <ImportSheetButton />
          <TransactionForm />
        </div>
      </header>

      {!result.success && (
        <p className="mb-6 shrink-0 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-4 py-3 text-sm text-[#F87171]">
          {result.message}
        </p>
      )}

      <div className="space-y-5 md:flex md:min-h-0 md:flex-1 md:flex-col md:space-y-0 md:gap-5">
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
