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
    "h-[42px] cursor-pointer appearance-none rounded-lg border border-[#334155] bg-[#172033] bg-[linear-gradient(45deg,transparent_50%,#94A3B8_50%),linear-gradient(135deg,#94A3B8_50%,transparent_50%)] bg-[position:calc(100%-16px)_17px,calc(100%-11px)_17px] bg-[size:5px_5px,5px_5px] bg-no-repeat px-3 pr-9 text-sm font-bold text-[#F8FAFC] outline-none transition-colors hover:border-[#475569] focus:border-[#10B981] [&>option]:bg-[#172033] [&>option]:text-[#F8FAFC]";

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
