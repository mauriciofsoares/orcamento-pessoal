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
    "cursor-pointer rounded-lg border border-[#334155] bg-[#172033] px-3 py-2 text-sm font-bold text-[#F8FAFC] outline-none transition-colors hover:border-[#475569] focus:border-[#10B981]";

  return (
    <div
      className={`flex items-center gap-2 ${isPending ? "opacity-60" : ""}`}
      aria-busy={isPending}
    >
      <CalendarDays className="size-4 text-[#F8FAFC]" aria-hidden />
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
