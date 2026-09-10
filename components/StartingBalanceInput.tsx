"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <section className="rounded-2xl border border-[#334155] bg-[#172033] p-5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <label
              htmlFor="starting-balance"
              className="font-outfit text-base font-semibold text-[#F8FAFC]"
            >
              Saldo inicial
            </label>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Quanto você tem em conta hoje. A projeção acumula a partir daqui.
            </p>
        </div>

        <div className="flex w-full items-center gap-2 rounded-[10px] border border-[#334155] bg-[#0B1220] px-4 py-3 focus-within:border-[#10B981] sm:w-[220px]">
          <span className="text-xs text-[#94A3B8]">R$</span>
          <input
            ref={inputRef}
            id="starting-balance"
            type="text"
            inputMode="decimal"
            defaultValue={toInputText(value)}
            onChange={handleChange}
            placeholder="0,00"
            className="min-w-0 flex-1 bg-transparent text-right text-xs tabular-nums text-[#F8FAFC] outline-none placeholder:text-[#64748B]"
          />
        </div>
      </div>
    </section>
  );
}
