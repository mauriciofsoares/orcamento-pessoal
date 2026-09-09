"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/transactions";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

export type ImportSummary = {
  imported: number;
  skipped: number;
  issues: string[];
};

// Linhas de totalizador/cabecalho da planilha que nao sao lancamentos.
const SUMMARY_ROW = /^(total|saldo|entradas?|sa[ií]das?|d[ií]vidas?|resumo|soma|subtotal)\b/i;
const INCOME_SECTION = /^entradas?\b/i;
const EXPENSE_SECTION = /^(sa[ií]das?|d[ií]vidas?|despesas?)\b/i;

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Aceita "1.234,56" (pt-BR) e "1,234.56" (formatacao en-US que o SheetJS aplica):
// o ultimo separador e o decimal, desde que tenha 1 ou 2 casas depois dele.
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;

  const decimalPos = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const decimals = decimalPos === -1 ? 0 : cleaned.length - decimalPos - 1;

  const normalized =
    decimals > 0 && decimals <= 2
      ? `${cleaned.slice(0, decimalPos).replace(/[.,]/g, "")}.${cleaned.slice(decimalPos + 1)}`
      : cleaned.replace(/[.,]/g, "");

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

// Meio-dia UTC pelo mesmo motivo do formulario: evitar recuar um dia no fuso local.
function parseDate(raw: string): Date | null {
  const text = raw.trim();
  let day: number;
  let month: number;
  let year: number;

  const brazilian = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);

  if (brazilian) {
    day = Number(brazilian[1]);
    month = Number(brazilian[2]);
    year = Number(brazilian[3]);
    if (year < 100) year += 2000;
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, 12));

  // Rejeita datas que "transbordam", como 31/02.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

// Exportacoes do Excel costumam vir em Windows-1252; decodificar como UTF-8 quebraria os acentos.
function decodeCsv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function readCsvRows(buffer: ArrayBuffer): string[][] {
  const parsed = Papa.parse<string[]>(decodeCsv(buffer), {
    skipEmptyLines: "greedy",
  });

  return parsed.data.filter(Array.isArray);
}

// raw:false devolve o texto JA formatado pelo Excel ("15/09/2026", "R$ 3.200,00"),
// entao o mesmo parser do CSV serve para as duas origens.
function readSheetRows(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  return rows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      cell === null || cell === undefined ? "" : String(cell),
    ),
  );
}

function findColumns(rows: string[][]) {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const headers = rows[index].map(normalizeHeader);
    const title = headers.findIndex((h) => /divida|titulo|descricao/.test(h));
    const dueDate = headers.findIndex((h) => /vencimento|data/.test(h));

    if (title >= 0 && dueDate >= 0) {
      return {
        headerIndex: index,
        title,
        dueDate,
        paymentMethod: headers.findIndex((h) => /forma|pagamento|metodo/.test(h)),
        amount: headers.findIndex((h) => /^valor|^r\$/.test(h)),
        remaining: headers.findIndex((h) => /falta/.test(h)),
        type: headers.findIndex((h) => /^tipo$/.test(h)),
      };
    }
  }

  return null;
}

export async function importTransactionsAction(
  formData: FormData,
): Promise<ActionResult<ImportSummary>> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Selecione uma planilha." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { success: false, message: "Arquivo muito grande (limite de 5 MB)." };
  }

  const extension = /\.(csv|xlsx|xlsm|xls)$/i.exec(file.name)?.[1].toLowerCase();

  if (!extension) {
    return {
      success: false,
      message: "Formato não suportado. Envie um arquivo .csv, .xls ou .xlsx.",
    };
  }

  const buffer = await file.arrayBuffer();
  let rows: string[][];

  try {
    rows = extension === "csv" ? readCsvRows(buffer) : readSheetRows(buffer);
  } catch {
    return {
      success: false,
      message: "Não foi possível ler o arquivo. Ele pode estar corrompido.",
    };
  }

  const columns = findColumns(rows);

  if (!columns) {
    return {
      success: false,
      message:
        'Não encontrei as colunas obrigatórias. A planilha precisa ter "Divida" e "Vencimento".',
    };
  }

  const issues: string[] = [];
  const pending: {
    title: string;
    type: "INCOME" | "EXPENSE";
    paymentMethod: string;
    dueDate: Date;
    amount: string;
    isPaid: boolean;
  }[] = [];

  let section: "INCOME" | "EXPENSE" = "EXPENSE";
  let skipped = 0;

  const cell = (row: string[], index: number) =>
    index >= 0 ? (row[index] ?? "").trim() : "";

  for (let index = columns.headerIndex + 1; index < rows.length; index += 1) {
    if (pending.length >= MAX_ROWS) {
      issues.push(`Importação limitada às primeiras ${MAX_ROWS} linhas.`);
      break;
    }

    const row = rows[index];
    const title = cell(row, columns.title);
    const lineNumber = index + 1;

    if (INCOME_SECTION.test(title)) {
      section = "INCOME";
      continue;
    }

    if (EXPENSE_SECTION.test(title)) {
      section = "EXPENSE";
      continue;
    }

    if (!title || SUMMARY_ROW.test(title)) continue;

    const dueDate = parseDate(cell(row, columns.dueDate));
    const amount = parseAmount(cell(row, columns.amount));

    if (!dueDate) {
      skipped += 1;
      issues.push(`Linha ${lineNumber} (${title}): data de vencimento inválida.`);
      continue;
    }

    if (amount === null || amount <= 0) {
      skipped += 1;
      issues.push(`Linha ${lineNumber} (${title}): valor inválido.`);
      continue;
    }

    const rawType = normalizeHeader(cell(row, columns.type));
    const type = rawType
      ? /receita|entrada|income/.test(rawType)
        ? "INCOME"
        : "EXPENSE"
      : section;

    // "Falta pagar" zerado (ou coluna ausente com valor vazio) significa conta quitada.
    const remainingCell = cell(row, columns.remaining);
    const remaining = parseAmount(remainingCell);
    const isPaid = columns.remaining >= 0 && remaining !== null && remaining === 0;

    pending.push({
      title: title.slice(0, 120),
      type,
      paymentMethod: cell(row, columns.paymentMethod) || "Não informado",
      dueDate,
      amount: amount.toFixed(2),
      isPaid,
    });
  }

  if (pending.length === 0) {
    return {
      success: false,
      message: "Nenhuma linha válida encontrada no arquivo.",
    };
  }

  try {
    await prisma.$transaction(
      pending.map((data) => prisma.transaction.create({ data })),
    );

    revalidatePath("/");
    revalidatePath("/projection");

    return {
      success: true,
      data: { imported: pending.length, skipped, issues: issues.slice(0, 10) },
    };
  } catch {
    return {
      success: false,
      message: "Falha ao gravar os lançamentos. Nenhum registro foi importado.",
    };
  }
}
