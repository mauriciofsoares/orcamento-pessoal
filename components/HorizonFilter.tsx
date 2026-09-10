"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function HorizonFilter({
  months,
  options,
}: {
  months: number;
  options: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function selectHorizon(option: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("months", String(option));
    startTransition(() => router.replace(`/projection?${params.toString()}`));
  }

  return (
    <div
      className={`flex w-full items-center gap-1 rounded-[10px] border border-[#334155] bg-[#0B1220] p-1 sm:w-auto ${
        isPending ? "opacity-60" : ""
      }`}
      aria-busy={isPending}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => selectHorizon(option)}
          className={`h-[38px] flex-1 rounded-lg px-2 text-[13px] transition-colors sm:h-auto sm:flex-none sm:px-4 sm:py-2.5 sm:text-sm ${
            months === option
              ? "bg-[#10B981] font-bold text-[#F8FAFC] shadow-[0_6px_14px_-6px_rgba(16,185,129,0.2)]"
              : "font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
          }`}
        >
          {option} meses
        </button>
      ))}
    </div>
  );
}
