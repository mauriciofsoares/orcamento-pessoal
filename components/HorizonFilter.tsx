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
      className={`flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 p-1 dark:border-slate-800 dark:bg-transparent ${
        isPending ? "opacity-60" : ""
      }`}
      aria-busy={isPending}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => selectHorizon(option)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            months === option
              ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {option} meses
        </button>
      ))}
    </div>
  );
}
