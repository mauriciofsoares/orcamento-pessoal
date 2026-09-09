"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { MONTH_NAMES } from "@/lib/format";

export function MonthFilter({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const years = Array.from({ length: 7 }, (_, index) => year - 3 + index);

  function updateFilter(key: "month" | "year", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    startTransition(() => router.replace(`/?${params.toString()}`));
  }

  const selectClass =
    "cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600";

  return (
    <div
      className={`flex items-center gap-2 ${isPending ? "opacity-60" : ""}`}
      aria-busy={isPending}
    >
      <CalendarDays className="size-4 text-slate-400 dark:text-slate-500" aria-hidden />
      <select
        aria-label="Mês"
        className={selectClass}
        value={month}
        onChange={(event) => updateFilter("month", event.target.value)}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <span className="text-slate-400 dark:text-slate-600">/</span>
      <select
        aria-label="Ano"
        className={selectClass}
        value={year}
        onChange={(event) => updateFilter("year", event.target.value)}
      >
        {years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
