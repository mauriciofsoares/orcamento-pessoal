"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, X } from "lucide-react";
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
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
      >
        <Sparkles className="size-4" aria-hidden />
        Importação Inteligente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm dark:bg-slate-950/80"
            onClick={close}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-import-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="ai-import-title"
                  className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-slate-100"
                >
                  <Sparkles className="size-5 text-indigo-400" aria-hidden />
                  Leitura e Importação Inteligente
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  Cole texto de extrato, fatura ou tabela. O sistema detecta a estrutura automaticamente: usa processamento local e preciso para planilhas e IA de alta velocidade (Groq) para interpretar textos livres e bagunçados.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {preview === null ? (
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder={PLACEHOLDER}
                rows={12}
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      <th className="px-3 py-2 font-medium">Título</th>
                      <th className="px-3 py-2 font-medium">Método</th>
                      <th className="px-3 py-2 font-medium">Vencimento</th>
                      <th className="px-3 py-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, index) => (
                      <tr
                        key={`${item.title}-${index}`}
                        className="border-t border-slate-200 dark:border-slate-800"
                      >
                        <td className="px-3 py-2 text-slate-950 dark:text-slate-100">
                          {item.title}
                          {item.type === "INCOME" && (
                            <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                              receita
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {item.paymentMethod}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                          {formatDate(`${item.dueDate}T12:00:00.000Z`)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-950 dark:text-slate-100">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={preview === null ? close : () => setPreview(null)}
                disabled={isBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {preview === null ? "Cancelar" : "Voltar"}
              </button>
              <button
                type="button"
                onClick={preview === null ? handleExtract : handleSave}
                disabled={isBusy || (preview === null && rawText.trim().length < 10)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
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
