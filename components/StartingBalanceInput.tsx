"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { parseCurrencyInput } from "@/lib/format";

const STORAGE_KEY = "orcamento:starting-balance";
const DEBOUNCE_MS = 500;

const balanceFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toInputText(value: number) {
  return value === 0 ? "" : balanceFormatter.format(value);
}

export function StartingBalanceInput({ value }: { value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasBalanceParam = searchParams.has("balance");

  function pushBalance(balance: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("balance", String(balance));
    router.replace(`/projection?${params.toString()}`);
  }

  // A URL e a fonte da verdade (o servidor calcula a projecao). O localStorage so
  // repoe o ultimo saldo quando a tela abre sem o parametro.
  useEffect(() => {
    if (hasBalanceParam) return;

    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    if (!Number.isFinite(saved) || saved === 0) return;

    if (inputRef.current) inputRef.current.value = toInputText(saved);
    pushBalance(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBalanceParam]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const balance = parseCurrencyInput(raw) ?? 0;
      window.localStorage.setItem(STORAGE_KEY, String(balance));
      pushBalance(balance);
    }, DEBOUNCE_MS);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <label
              htmlFor="starting-balance"
              className="text-sm font-semibold text-slate-900 dark:text-slate-200"
            >
              Saldo inicial
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Quanto você tem em conta hoje. A projeção acumula a partir daqui.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-emerald-500 dark:border-slate-700 dark:bg-slate-950">
          <span className="text-sm text-slate-500 dark:text-slate-500">R$</span>
          <input
            ref={inputRef}
            id="starting-balance"
            type="text"
            inputMode="decimal"
            defaultValue={toInputText(value)}
            onChange={handleChange}
            placeholder="0,00"
            className="w-32 bg-transparent text-right text-sm tabular-nums text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600"
          />
        </div>
      </div>
    </section>
  );
}
