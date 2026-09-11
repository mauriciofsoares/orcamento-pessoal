"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Sparkles, X } from "lucide-react";
import {
  importWithAIAction,
  saveAiTransactionsAction,
  type AiTransaction,
} from "@/actions/ai-import";
import { formatCurrency, formatDate } from "@/lib/format";

const PLACEHOLDER = `Cole aqui o texto do extrato, fatura ou planilha. Exemplo:

10/09 Financiamento do apê - débito em conta R$ 3.200,00
15/09 Condomínio boleto 850,90
05/09 Salário depósito 8.500,00`;

export function AiImportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<AiTransaction[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function close() {
    setIsOpen(false);
    setRawText("");
    setPreview(null);
  }

  async function handleExtract() {
    setIsBusy(true);
    const toastId = toast.loading("Analisando seus dados...");

    const result = await importWithAIAction(rawText);
    setIsBusy(false);

    if (!result.success) {
      toast.error(result.message, { id: toastId });
      return;
    }

    setPreview(result.data.transactions);
    toast.success(
      `${result.data.transactions.length} lançamento(s) encontrado(s)`,
      {
        id: toastId,
        description:
          result.data.discarded > 0
            ? `${result.data.discarded} descartado(s) por dados inconsistentes`
            : "Revise antes de salvar",
      },
    );
  }

  async function handleSave() {
    if (!preview) return;

    setIsBusy(true);
    const result = await saveAiTransactionsAction(preview);
    setIsBusy(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(`${result.data.imported} lançamento(s) importado(s)`);
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="col-span-2 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#10B981] bg-gradient-to-r from-[#0FBA82] to-[#33D499] px-4 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(15,186,130,0.3)] transition-opacity hover:opacity-90 lg:h-9 lg:w-auto"
      >
        <Sparkles className="size-4" aria-hidden />
        Importação Inteligente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-import-title"
            className="relative flex max-h-[90dvh] w-full max-w-xl flex-col gap-6 overflow-y-auto rounded-2xl border border-[#334155] bg-[#1E293B] px-6 py-8 shadow-[0_16px_48px_rgba(0,0,0,0.25)] sm:px-8 sm:py-9"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="ai-import-title"
                  className="flex items-center gap-3 font-outfit text-xl font-bold text-[#F8FAFC] sm:text-2xl"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/10 text-[#10B981]">
                    <Sparkles className="size-5" aria-hidden />
                  </span>
                  Leitura e Importação Inteligente
                </h2>
                <p className="mt-4 text-sm leading-5 text-[#94A3B8]">
                  Cole seu extrato, fatura ou planilha abaixo. Nossa inteligência artificial organiza os dados automaticamente para você.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="shrink-0 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-[#172033] hover:text-[#F8FAFC]"
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </div>

            {preview === null ? (
              <>
                <textarea
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={10}
                  className="min-h-[280px] w-full resize-none rounded-lg border border-[#334155] bg-[#020617] p-4 text-sm leading-5 text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#10B981]"
                />
                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#334155]/60" />
                    <span className="text-xs font-semibold text-[#94A3B8]">ou</span>
                    <span className="h-px flex-1 bg-[#334155]/60" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#10B981] bg-[#10B981]/10 text-[#10B981]">
                      <Mic className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#F8FAFC]">Fale seus lançamentos</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#94A3B8]">
                        Diga os valores e descrições. O sistema converte em importação.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#334155] bg-[#172033]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#172033]">
                    <tr className="text-xs font-semibold uppercase text-[#64748B]">
                      <th className="px-4 py-3 font-semibold">Título</th>
                      <th className="px-4 py-3 font-semibold">Método</th>
                      <th className="px-4 py-3 font-semibold">Vencimento</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, index) => (
                      <tr
                        key={`${item.title}-${index}`}
                        className="border-t border-[#334155]"
                      >
                        <td className="px-4 py-3 text-[#F8FAFC]">
                          {item.title}
                          {item.type === "INCOME" && (
                            <span className="ml-2 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[11px] text-[#10B981]">
                              receita
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#94A3B8]">
                          {item.paymentMethod}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[#94A3B8]">
                          {formatDate(`${item.dueDate}T12:00:00.000Z`)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[#F8FAFC]">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={preview === null ? close : () => setPreview(null)}
                disabled={isBusy}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#334155] bg-[#172033] px-4 text-sm font-bold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {preview === null ? "Cancelar" : "Voltar"}
              </button>
              <button
                type="button"
                onClick={preview === null ? handleExtract : handleSave}
                disabled={isBusy || (preview === null && rawText.trim().length < 10)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#10B981] bg-[#10B981] px-4 text-sm font-bold text-[#020617] shadow-[0_2px_10px_rgba(15,186,130,0.3)] transition-colors hover:bg-[#34D399] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {isBusy
                  ? "Processando..."
                  : preview === null
                    ? "Analisar importação"
                    : `Salvar ${preview.length} lançamento(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
