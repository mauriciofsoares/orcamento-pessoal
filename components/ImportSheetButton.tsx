"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { importTransactionsAction } from "@/actions/import";

export function ImportSheetButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsImporting(true);
    const toastId = toast.loading(`Importando ${file.name}...`);

    const result = await importTransactionsAction(formData);

    setIsImporting(false);
    // Permite reenviar o mesmo arquivo depois de corrigi-lo.
    if (inputRef.current) inputRef.current.value = "";

    if (!result.success) {
      toast.error(result.message, { id: toastId });
      return;
    }

    const { imported, skipped, issues } = result.data;

    toast.success(`${imported} lançamento(s) importado(s)`, {
      id: toastId,
      description:
        skipped > 0 ? `${skipped} linha(s) ignorada(s) por dados inválidos` : undefined,
    });

    for (const issue of issues) {
      toast.warning(issue);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#334155] bg-[#172033] px-4 text-[13px] font-bold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="size-4" aria-hidden />
        {isImporting ? "Importando..." : "Importar planilha"}
      </button>
    </>
  );
}
