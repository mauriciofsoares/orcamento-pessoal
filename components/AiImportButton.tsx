"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, CircleX, Loader2, MicOff, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  importWithAIAction,
  saveAiTransactionsAction,
  type AiTransaction,
} from "@/actions/ai-import";
import { formatCurrency, formatDate } from "@/lib/format";
import { ConfirmModal } from "@/components/ConfirmModal";

const PLACEHOLDER = `Cole aqui o texto do extrato, fatura ou planilha. Exemplo:

10/09 Financiamento do apê - débito em conta R$ 3.200,00
15/09 Condomínio boleto 850,90
05/09 Salário depósito 8.500,00`;

type IntelligentLaunchState = "idle" | "analyzing" | "results";

export function AiImportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [stage, setStage] = useState<IntelligentLaunchState>("idle");
  const [preview, setPreview] = useState<AiTransaction[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const editingItem = editingIndex === null ? null : preview[editingIndex];
  const deletingItem = deletingIndex === null ? null : preview[deletingIndex];

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isBusy]);

  function close() {
    setIsOpen(false);
    setRawText("");
    setStage("idle");
    setPreview([]);
    setEditingIndex(null);
    setDeletingIndex(null);
  }

  async function handleExtract() {
    if (stage !== "idle" || isBusy) return;

    setIsBusy(true);
    setStage("analyzing");
    const toastId = toast.loading("Analisando seus dados...");

    try {
      const result = await importWithAIAction(rawText);

      if (!result.success) {
        toast.error(result.message, { id: toastId });
        setStage("idle");
        return;
      }

      setPreview(result.data.transactions);
      setStage("results");
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
    } catch {
      toast.error("Não foi possível analisar os lançamentos. Tente novamente.", {
        id: toastId,
      });
      setStage("idle");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave() {
    if (stage !== "results" || isBusy || preview.length === 0) return;

    setIsBusy(true);

    try {
      const result = await saveAiTransactionsAction(preview);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${result.data.imported} lançamento(s) importado(s)`);
      close();
    } catch {
      toast.error("Não foi possível salvar os lançamentos. Tente novamente.");
    } finally {
      setIsBusy(false);
    }
  }

  function removePreviewItem() {
    if (deletingIndex === null) return;

    setPreview((items) => items.filter((_, index) => index !== deletingIndex));
    setDeletingIndex(null);
  }

  function updatePreviewItem(field: keyof AiTransaction, value: string) {
    if (editingIndex === null) return;

    setPreview((items) =>
      items.map((item, index) =>
        index === editingIndex
          ? { ...item, [field]: field === "amount" ? Number(value) || 0 : value }
          : item,
      ),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="col-span-2 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-[#10B981] bg-gradient-to-r from-[#0FBA82] to-[#33D499] px-4 text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(15,186,130,0.3)] transition-opacity hover:opacity-90 lg:h-9 lg:w-auto"
      >
        <Sparkles className="size-4" aria-hidden />
        Lançamento Inteligente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm"
            onClick={() => {
              if (!isBusy) close();
            }}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-import-title"
            className={`relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col gap-4 rounded-2xl border border-[#334155] bg-[#172033] px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.25)] sm:gap-6 sm:px-8 sm:py-9 [@media(max-height:800px)]:gap-4 [@media(max-height:800px)]:py-5 ${
              stage === "results" ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {stage !== "results" && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="ai-import-title"
                  className="flex items-start gap-3 font-outfit text-[23px] font-bold leading-[1.14] text-[#F8FAFC] sm:text-2xl"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/10 text-[#10B981]">
                    <Sparkles className="size-5" aria-hidden />
                  </span>
                  Leitura e Lançamento Inteligente
                </h2>
                <p className="mt-3 text-base leading-[1.4] text-[#94A3B8] sm:text-sm [@media(max-height:800px)]:mt-2">
                  Cole seu extrato, fatura ou planilha abaixo. Nossa inteligência artificial organiza os dados automaticamente para você.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                disabled={isBusy}
                className="shrink-0 rounded-lg p-1 text-[#94A3B8] transition-colors hover:bg-[#172033] hover:text-[#F8FAFC]"
              >
                <CircleX className="size-4" aria-hidden />
              </button>
            </div>
            )}

            {stage === "results" && (
              <div className="mx-5 flex items-center gap-3 rounded-xl border border-[#10B981]/40 bg-[#052E20] px-4 py-3 sm:mx-8">
                <Check className="size-5 text-[#34D399]" aria-hidden />
                <div><p className="text-sm font-bold text-[#34D399]">{preview.length} lançamento{preview.length === 1 ? "" : "s"} encontrado{preview.length === 1 ? "" : "s"}</p><p className="text-xs text-[#A7F3D0]">Revise antes de salvar.</p></div>
              </div>
            )}

            <div className={stage === "results" ? "min-h-0 flex-1 overflow-y-auto" : ""}>
            {stage === "idle" ? (
              <>
                <textarea
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={8}
                  disabled={isBusy}
                  className="h-[224px] w-full resize-none rounded-lg border border-[#334155] bg-[#020617] p-3.5 text-sm leading-5 text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#10B981] disabled:opacity-60"
                />
                <div className="mt-5 flex items-center gap-3">
                  <button type="button" disabled aria-label="Lançamento por voz indisponível" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#10B981] bg-[#10B981]/10 text-[#10B981]">
                      <MicOff className="size-5" aria-hidden />
                    </button>
                    <div>
                      <p className="text-sm font-bold text-[#F8FAFC]">Fale seus lançamentos</p>
                      <p className="mt-1 text-[13px] leading-5 text-[#94A3B8]">
                        Diga os valores e descrições - o sistema converte em lançamento.
                      </p>
                    </div>
                </div>
              </>
            ) : stage === "analyzing" ? (
              <>
                <div className="flex h-[224px] flex-col justify-center gap-3 rounded-lg border border-[#334155] bg-[#020617] p-4">
                  {["w-full", "w-2/3", "w-full", "w-1/2", "w-5/6", "w-full"].map((width, index) => <span key={index} className={`h-3 animate-pulse rounded-full bg-[#1E293B] ${width}`} />)}
                </div>
                <p className="mt-4 flex items-center gap-2 text-sm text-[#94A3B8]"><Sparkles className="size-4 text-[#10B981]" aria-hidden />Analisando seus lançamentos...</p>
                <div className="mt-5 flex items-center gap-3 opacity-50"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#10B981] bg-[#10B981]/10 text-[#10B981]"><MicOff className="size-5" aria-hidden /></span><div><p className="text-sm font-bold text-[#F8FAFC]">Fale seus lançamentos</p><p className="mt-1 text-[13px] text-[#94A3B8]">Diga os valores e descrições - o sistema converte em lançamento.</p></div></div>
              </>
            ) : (
              <><h2 className="font-outfit text-xl font-bold text-[#F8FAFC]">Leitura e Lançamento Inteligente</h2><p className="mt-2 text-sm text-[#94A3B8]">Revise os dados identificados antes de salvar.</p><div className="mt-4 space-y-3 pb-4">{preview.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-2xl border border-[#334155] bg-[#172033] p-4"><div className="flex items-start gap-2"><h3 className="min-w-0 flex-1 text-base font-bold text-[#F8FAFC]">{item.title}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.type === "INCOME" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F87171]/10 text-[#F87171]"}`}>{item.type === "INCOME" ? "Receita" : "Despesa"}</span><button type="button" onClick={() => setEditingIndex(index)} aria-label={`Editar ${item.title}`} className="rounded-lg border border-[#334155] p-1.5 text-[#94A3B8]"><Pencil className="size-4" /></button><button type="button" onClick={() => setDeletingIndex(index)} aria-label={`Excluir ${item.title}`} className="rounded-lg border border-[#334155] p-1.5 text-[#94A3B8]"><Trash2 className="size-4" /></button></div><dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[#64748B]">Método</dt><dd className="mt-1 text-[#94A3B8]">{item.paymentMethod}</dd></div><div><dt className="text-[#64748B]">Data</dt><dd className="mt-1 text-[#94A3B8]">{formatDate(`${item.dueDate}T12:00:00.000Z`)}</dd></div><div className="col-span-2 flex items-end justify-between"><dt className="text-[#64748B]">Valor</dt><dd className={`font-outfit text-xl font-bold ${item.type === "INCOME" ? "text-[#34D399]" : "text-[#F87171]"}`}>{formatCurrency(item.amount)}</dd></div></dl></article>)}</div></>
            )}
            </div>

            <div className={`flex shrink-0 gap-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:justify-end ${
              stage === "results" ? "flex-row" : "flex-col sm:flex-row"
            }`}>
              <button
                type="button"
                onClick={() => {
                  if (stage === "idle") close();
                  if (stage === "results") {
                    setStage("idle");
                    setPreview([]);
                  }
                }}
                disabled={isBusy}
                className="order-2 inline-flex h-11 w-full shrink-0 items-center justify-center rounded-[10px] border border-[#334155] bg-transparent px-4 text-sm font-bold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60 md:order-1 md:h-10 md:w-auto"
              >
                {stage === "results" ? "Voltar" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={stage === "results" ? handleSave : handleExtract}
                disabled={isBusy || (stage === "idle" && rawText.trim().length < 10)}
                className="order-1 inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#10B981] to-[#34D399] px-4 text-sm font-bold text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 md:order-2 md:h-10 md:w-auto"
              >
                {isBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {isBusy
                  ? "Analisando..."
                  : stage === "idle"
                    ? "Analisar lançamento"
                    : `Salvar ${preview.length} lançamento${preview.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
          <ConfirmModal open={deletingItem !== null} title="Excluir lançamento?" description={<>Tem certeza que deseja excluir o lançamento <strong>{deletingItem?.title}</strong>? Esta ação não pode ser desfeita.</>} actions={[{ label: "Excluir", onClick: removePreviewItem }]} onClose={() => setDeletingIndex(null)} />
          {editingItem && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-[#020617]/80" onClick={() => setEditingIndex(null)} aria-hidden />
              <div role="dialog" aria-modal="true" aria-label="Editar lançamento" className="relative w-full max-w-md rounded-2xl border border-[#334155] bg-[#172033] p-5">
                <div className="flex items-center justify-between"><h2 className="font-outfit text-xl font-bold text-[#F8FAFC]">Editar lançamento</h2><button type="button" aria-label="Fechar" onClick={() => setEditingIndex(null)} className="text-[#94A3B8]"><CircleX className="size-5" /></button></div>
                <div className="mt-5 space-y-3"><input aria-label="Título" className="h-12 w-full rounded-lg border border-[#334155] bg-[#020617] px-4 text-[#F8FAFC]" value={editingItem.title} onChange={(event) => updatePreviewItem("title", event.target.value)} /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><select aria-label="Tipo" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.type} onChange={(event) => updatePreviewItem("type", event.target.value)}><option value="EXPENSE">Despesa</option><option value="INCOME">Receita</option></select><input aria-label="Método" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-4 text-[#F8FAFC]" value={editingItem.paymentMethod} onChange={(event) => updatePreviewItem("paymentMethod", event.target.value)} /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input aria-label="Data" type="date" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.dueDate} onChange={(event) => updatePreviewItem("dueDate", event.target.value)} /><input aria-label="Valor" type="number" step="0.01" className="h-12 rounded-lg border border-[#334155] bg-[#020617] px-3 text-[#F8FAFC]" value={editingItem.amount} onChange={(event) => updatePreviewItem("amount", event.target.value)} /></div></div>
                <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingIndex(null)} className="h-10 rounded-lg border border-[#334155] px-4 text-sm font-semibold text-[#F8FAFC]">Cancelar</button><button type="button" onClick={() => setEditingIndex(null)} className="h-10 rounded-lg bg-[#10B981] px-4 text-sm font-bold text-[#020617]">Salvar alterações</button></div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
