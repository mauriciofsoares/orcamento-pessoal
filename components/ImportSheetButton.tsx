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
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Upload className="size-4" aria-hidden />
        {isImporting ? "Importando..." : "Importar planilha"}
      </button>
    </>
  );
}
