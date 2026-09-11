"use server";

import { revalidatePath } from "next/cache";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseCurrencyInput } from "@/lib/format";
import type { ActionResult } from "@/actions/transactions";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAuthenticatedIdentity } from "@/lib/auth/get-authenticated-identity";

const MAX_INPUT_CHARS = 8000;
const MAX_ITEMS = 200;
const TIMEOUT_MS = 180_000;

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

// Schema entregue ao modelo: campos simples e descritos, sem transforms.
const extractionSchema = z.object({
  transactions: z.array(
    z.object({
      title: z.string().nullable().describe("Nome da conta, dívida ou receita; null se ausente"),
      amount: z.number().nullable().describe("Valor em reais, apenas o número; null se ausente"),
      dueDate: z
        .string()
        .nullable()
        .describe("Data em YYYY-MM-DD; null se não informada"),
      type: z
        .enum(["INCOME", "EXPENSE"])
        .nullable()
        .describe(
          "Classifique como INCOME quando o dinheiro entra: Salario, Pix recebido, Deposito, Credito recebido, TED recebida, Transferencia recebida, Rendimento, Receita, Reembolso ou valor com sinal +. Classifique como EXPENSE quando o dinheiro sai: compras, pagamentos, contas, boletos, Uber, iFood, assinaturas, cartao de credito ou valor com sinal -.",
        ),
      paymentMethod: z
        .string()
        .nullable()
        .describe("Forma de pagamento; null se não informada"),
    }),
  ),
});

export type AiTransaction = {
  title: string | null;
  amount: number | null;
  dueDate: string | null;
  type: "INCOME" | "EXPENSE" | null;
  paymentMethod: string | null;
};

const aiDraftSchema = z.object({
  title: z.string().trim().min(1).max(120).nullable(),
  amount: z.number().positive().max(99_999_999.99).nullable(),
  dueDate: z.union([z.iso.date(), z.null()]),
  type: z.enum(["INCOME", "EXPENSE"]).nullable(),
  paymentMethod: z.string().trim().min(1).max(60).nullable(),
});

// Segunda validacao, agora desconfiando do modelo: datas e valores impossiveis sao descartados.
const persistedSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(99_999_999.99),
  dueDate: z.iso.date(),
  type: z.enum(["INCOME", "EXPENSE"]),
  paymentMethod: z.string().trim().min(1).max(60),
});

const MONTHS: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

const INCOME_KEYWORDS = [
  "salario",
  "adiantamento salario",
  "pix recebido",
  "deposito",
  "credito recebido",
  "ted recebida",
  "transferencia recebida",
  "rendimento",
  "receita",
  "reembolso",
  "estorno",
  "fgts",
];

const EXPENSE_KEYWORDS = [
  "compra",
  "pagamento",
  "boleto",
  "conta",
  "fatura",
  "uber",
  "ifood",
  "mercado",
  "assinatura",
  "mensalidade",
  "cartao de credito",
  "debito",
];

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toIsoDate(value: unknown) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  const currentYear = new Date().getFullYear();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return trimmed;

  const slashDate = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(trimmed);
  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const year = slashDate[3]
      ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
      : currentYear;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const textDate = /^(\d{1,2})\s+([a-zA-Z\u00c0-\u00ff]{3,})(?:\s+(\d{2,4}))?$/.exec(trimmed);
  if (textDate) {
    const day = Number(textDate[1]);
    const month = MONTHS[stripAccents(textDate[2])];
    const year = textDate[3]
      ? Number(textDate[3].length === 2 ? `20${textDate[3]}` : textDate[3])
      : currentYear;

    if (month) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return value;
}

function findDateInLine(line: string) {
  const slashDate = /\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/.exec(line);
  if (slashDate) {
    return { raw: slashDate[1], iso: toIsoDate(slashDate[1]) };
  }

  const textDate = /\b(\d{1,2}\s+[a-zA-Z\u00c0-\u00ff]{3,}(?:\s+\d{2,4})?)\b/.exec(line);
  if (textDate) {
    return { raw: textDate[1], iso: toIsoDate(textDate[1]) };
  }

  return null;
}

function findAmountInLine(line: string) {
  const currencyAmount = /R\$\s*([+-])?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{2})?)/.exec(
    line,
  );
  const amount =
    currencyAmount ??
    /([+-])\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{2})?)/.exec(
      line,
    ) ??
    /\b(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/.exec(line);
  if (!amount) return null;

  const sign = amount[2] ? amount[1] : undefined;
  const numericText = amount[2] ?? amount[1];
  const value = parseCurrencyInput(`${sign ?? ""}${numericText}`);
  if (value === null) return null;

  return { raw: amount[0], sign, value: Math.abs(value) };
}

function isTableLikeText(text: string) {
  const normalized = stripAccents(text);
  return (
    normalized.includes("forma de pagamento") ||
    normalized.includes("vencimento") ||
    normalized.includes("\t") ||
    normalized.includes("total dividas") ||
    normalized.includes("entradas:")
  );
}

function classifyLine(
  line: string,
  fallbackType: "INCOME" | "EXPENSE" = "EXPENSE",
): "INCOME" | "EXPENSE" {
  const normalized = stripAccents(line);

  if (/[+]\s*(?:R\$\s*)?\d/.test(line)) return "INCOME";
  if (/[-]\s*(?:R\$\s*)?\d/.test(line)) return "EXPENSE";
  if (INCOME_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "INCOME";
  }
  if (EXPENSE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "EXPENSE";
  }

  return fallbackType;
}

function inferPaymentMethod(line: string) {
  const normalized = stripAccents(line);

  if (normalized.includes("pix")) return "Pix";
  if (normalized.includes("boleto")) return "Boleto";
  if (normalized.includes("ted")) return "TED";
  if (normalized.includes("debito em conta")) return "Debito em conta";
  if (normalized.includes("debito")) return "Debito";
  if (normalized.includes("cartao")) return "Cartao de credito";

  return "N\u00e3o informado";
}

function isCurrencyText(value: unknown) {
  return typeof value === "string" && /^(?:R\$\s*)?[+-]?\s*\d/.test(value.trim());
}

function normalizePaymentMethod(value: unknown, sourceLine = "") {
  if (value === null || value === undefined) {
    return sourceLine ? inferPaymentMethod(sourceLine) : null;
  }

  if (typeof value !== "string" || value.trim() === "" || isCurrencyText(value)) {
    return sourceLine ? inferPaymentMethod(sourceLine) : null;
  }

  if (stripAccents(value).trim() === "nao informado") {
    return "N\u00e3o informado";
  }

  return value.trim().slice(0, 60);
}

function capitalizeInitial(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanFallbackTitle(line: string, amountRaw: string, dateRaw?: string) {
  let title = line;

  if (dateRaw) title = title.replace(dateRaw, " ");
  if (amountRaw) title = title.replace(amountRaw, " ");

  const cleaned = title
    .replace(/^\s*entradas:\s*/i, "")
    .replace(/\bR\$\b/g, " ")
    .replace(/R\$\s*[+-]?\s*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+(?:\.\d{2})?)/g, " ")
    .replace(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/g, " ")
    .replace(/[+-]/g, " ")
    .replace(/n[a\u00e3]o informado/gi, " ")
    .replace(/receita/gi, " ")
    .replace(/\s*(?:Boleto|D[e\u00e9]bito em conta|Debito|Pix|TED)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return capitalizeInitial(cleaned);
}

function isIgnoredSummaryLine(line: string) {
  const normalized = stripAccents(line);
  return (
    normalized.startsWith("divida") ||
    normalized.startsWith("o que falta pagar") ||
    normalized.startsWith("total") ||
    normalized.startsWith("saldo restante") ||
    normalized.startsWith("salario r$") ||
    normalized.startsWith("entradas + saldo atual") ||
    normalized.startsWith("entradas saldo atual") ||
    normalized.startsWith("total atrasado") ||
    normalized.startsWith("quanto vou precisar") ||
    normalized === "nao" ||
    normalized.includes("forma de pagamento")
  );
}

function extractStartingBalanceLine(line: string) {
  const normalized = stripAccents(line);
  if (!normalized.startsWith("saldo atual")) return null;

  const amount = findAmountInLine(line);
  if (!amount) return null;

  return {
    title: "Saldo inicial",
    amount: amount.value,
    dueDate: null,
    type: "INCOME" as const,
    paymentMethod: "N\u00e3o informado",
  };
}

function isIgnoredExtractedTitle(title: string) {
  const normalized = stripAccents(title).replace(/\s+/g, " ").trim();
  return (
    normalized.startsWith("total") ||
    normalized.startsWith("saldo atual") ||
    normalized.startsWith("saldo restante") ||
    normalized.startsWith("entradas + saldo atual") ||
    normalized.startsWith("entradas saldo atual") ||
    normalized.startsWith("total atrasado") ||
    normalized.startsWith("quanto vou precisar") ||
    normalized === "salario" ||
    normalized === "receita"
  );
}

function extractFromTableLine(
  line: string,
  fallbackType: "INCOME" | "EXPENSE",
) {
  const columns = line
    .split("\t")
    .map((column) => column.trim())
    .filter(Boolean);

  if (columns.length < 2) return null;

  const amountColumnIndex = columns.findIndex((column) =>
    /(?:R\$|[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+,\d{2})/.test(
      column,
    ),
  );
  if (amountColumnIndex === -1) return null;

  const amount = findAmountInLine(columns[amountColumnIndex]);
  if (!amount) return null;

  const firstColumn = columns[0] ?? "";
  const firstColumnIsIncomeMarker = stripAccents(firstColumn).startsWith(
    "entradas",
  );
  const titleColumn = firstColumnIsIncomeMarker
    ? columns.find((column, index) => {
        if (index === 0 || index === amountColumnIndex) return false;

        const normalized = stripAccents(column);
        return (
          !normalized.includes("r$") &&
          !z.iso.date().safeParse(toIsoDate(column)).success
        );
      })
    : firstColumn;
  const title = cleanFallbackTitle(titleColumn ?? "", "");
  if (isIgnoredExtractedTitle(title)) return null;

  const paymentColumn = firstColumnIsIncomeMarker ? undefined : columns[1];
  const paymentMethod = normalizePaymentMethod(paymentColumn, line);
  const dateColumn = columns
    .slice(2, amountColumnIndex)
    .map((column) => toIsoDate(column))
    .find(
      (column): column is string =>
        typeof column === "string" && z.iso.date().safeParse(column).success,
    );
  const dueDate = dateColumn ?? null;

  return {
    title: title || null,
    amount: amount.value,
    dueDate,
    type: classifyLine(line, fallbackType),
    paymentMethod: paymentMethod || inferPaymentMethod(line),
  };
}

function fallbackExtractTransactions(text: string): AiTransaction[] {
  const fallbackItems: AiTransaction[] = [];
  let sectionType: "INCOME" | "EXPENSE" = "EXPENSE";

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const normalized = stripAccents(trimmed);
    if (normalized.startsWith("saldo atual")) {
      sectionType = "INCOME";

      const startingBalance = extractStartingBalanceLine(trimmed);
      if (startingBalance) {
        const parsed = aiDraftSchema.safeParse(startingBalance);
        if (parsed.success && parsed.data.dueDate && isRealDate(parsed.data.dueDate)) {
          fallbackItems.push(parsed.data);
        }
      }

      continue;
    }

    if (normalized.startsWith("entradas:")) {
      sectionType = "INCOME";
    }
    if (isIgnoredSummaryLine(trimmed)) continue;

    const tableItem = extractFromTableLine(trimmed, sectionType);
    if (tableItem) {
        const parsed = aiDraftSchema.safeParse(tableItem);
        if (parsed.success && parsed.data.dueDate && isRealDate(parsed.data.dueDate)) {
        fallbackItems.push(parsed.data);
      }
      continue;
    }

    const date = findDateInLine(trimmed);
    const amount = findAmountInLine(trimmed);
    if (!amount) continue;

    const dueDate = date && typeof date.iso === "string" ? date.iso : null;

    const title = cleanFallbackTitle(trimmed, amount.raw, date?.raw);
    if (isIgnoredExtractedTitle(title)) continue;

    const item = {
      title: title || null,
      amount: amount.value,
      dueDate,
      type: classifyLine(trimmed, sectionType),
      paymentMethod: inferPaymentMethod(trimmed),
    };

    const parsed = aiDraftSchema.safeParse(item);
    if (parsed.success && parsed.data.dueDate && isRealDate(parsed.data.dueDate)) {
      fallbackItems.push(parsed.data);
    }
  }

  return fallbackItems.slice(0, MAX_ITEMS);
}

function normalizeExtractedItem(item: unknown) {
  if (typeof item !== "object" || item === null) return item;

  const candidate = item as Record<string, unknown>;
  return {
    ...candidate,
    title:
      typeof candidate.title === "string"
        ? cleanFallbackTitle(candidate.title, "")
        : candidate.title,
    amount:
      typeof candidate.amount === "number"
        ? Math.abs(candidate.amount)
        : candidate.amount,
    dueDate: candidate.dueDate === null ? null : toIsoDate(candidate.dueDate),
    paymentMethod: normalizePaymentMethod(candidate.paymentMethod),
  };
}

function isRealDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Alguns providers nao abortam a geracao em andamento pelo abortSignal,
// entao a corrida garante que a action sempre devolva algo ao usuario.
function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), ms),
    ),
  ]);
}

export async function importWithAIAction(
  rawText: string,
): Promise<ActionResult<{ transactions: AiTransaction[]; discarded: number }>> {
  const user = await getAuthenticatedIdentity();
  if (!user) return { success: false, message: "Usuário não autenticado." };

  const text = rawText.trim();

  if (text.length < 10) {
    return { success: false, message: "Cole um texto com os lan\u00e7amentos." };
  }

  if (text.length > MAX_INPUT_CHARS) {
    return {
      success: false,
      message: `Texto muito longo (limite de ${MAX_INPUT_CHARS} caracteres). Divida em partes.`,
    };
  }

  const tableFallback = fallbackExtractTransactions(text);
  if (isTableLikeText(text) && tableFallback.length > 0) {
    return {
      success: true,
      data: {
        transactions: tableFallback,
        discarded: 0,
      },
    };
  }

  try {
    const { object } = await withTimeout(
      generateObject({
        model: groq(MODEL),
        schema: extractionSchema,
        // Cada tentativa e uma geracao completa; retry aqui triplicaria a espera.
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      system:
        "Voc\u00ea extrai lan\u00e7amentos financeiros de textos em portugu\u00eas do Brasil. " +
        "Responda apenas com os dados estruturados, sem coment\u00e1rios. " +
        "T\u00cdTULO: o t\u00edtulo do lan\u00e7amento deve sempre ter a primeira letra mai\u00fascula (ex: 'Fatura', 'Condom\u00ednio', 'Sal\u00e1rio'). " +
        "DATAS: o texto usa o padr\u00e3o brasileiro DIA/M\u00caS/ANO, nunca m\u00eas/dia. " +
        "Em '05/09/2026' o dia \u00e9 05 e o m\u00eas \u00e9 09, resultando em 2026-09-05. " +
        "Em '10/09/2026' o dia \u00e9 10 e o m\u00eas \u00e9 09, resultando em 2026-09-10. " +
        "Meses por extenso ou abreviados tamb\u00e9m s\u00e3o brasileiros: JAN=01, FEV=02, MAR=03, ABR=04, MAI=05, JUN=06, JUL=07, AGO=08, SET=09, OUT=10, NOV=11, DEZ=12. " +
        "Exemplos de datas: '05 SET' vira 2026-09-05, '10 setembro 2026' vira 2026-09-10. " +
        "Se o ano n\u00e3o aparecer, use o ano atual. Se a data n\u00e3o for informada, retorne dueDate como null. " +
        "Converta valores do formato brasileiro (1.234,56) para n\u00famero (1234.56) e sempre positivo. " +
        "TABELAS: quando o texto tiver colunas como Divida, Forma de pagamento, Vencimento e VALOR, cada linha com valor numerico e um lancamento. Ignore linhas com 'R$ -'. Ignore Total dividas, Saldo atual, subtotais e cabecalhos. " +
        "Em tabelas de orcamento, linhas depois de 'Saldo atual' normalmente sao entradas/receitas, exceto quando houver sinal ou palavra clara de despesa. " +
        "TIPO INCOME: use INCOME quando a linha indicar dinheiro entrando na conta. " +
        "Palavras e sinais fortes de INCOME: Sal\u00e1rio, Pix recebido, Dep\u00f3sito, Cr\u00e9dito recebido, TED recebida, Transfer\u00eancia recebida, Rendimento, Receita, Reembolso, Estorno ou valor com sinal de mais (+). " +
        "Exemplos de INCOME: '+ 8.500,00 Sal\u00e1rio', 'Pix recebido Jo\u00e3o 120,00', '05 SET PIX RECEBIDO JOAO +120,00', 'TED recebida Empresa 2.000,00', 'Rendimento aplica\u00e7\u00e3o 15,32', 'Dep\u00f3sito 500,00'. " +
        "TIPO EXPENSE: use EXPENSE quando a linha indicar dinheiro saindo da conta. " +
        "Palavras e sinais fortes de EXPENSE: compra, pagamento, boleto, conta, fatura, Uber, iFood, mercado, assinatura, mensalidade, cart\u00e3o de cr\u00e9dito, d\u00e9bito ou valor com sinal de menos (-). " +
        "Exemplos de EXPENSE: '- 42,90 iFood', '10 SET UBER -27,80', 'Uber 27,80', 'Pagamento boleto aluguel 1.500,00', 'Netflix assinatura 39,90', 'Compra cart\u00e3o de cr\u00e9dito 230,00'. " +
        "Se houver conflito, priorize sinais expl\u00edcitos: '+' e palavras como recebido/deposito/rendimento indicam INCOME; '-' e palavras como pagamento/compra/fatura indicam EXPENSE. " +
        "Ignore saldos, totais, subtotais, cabe\u00e7alhos e qualquer linha que n\u00e3o seja um lan\u00e7amento individual. " +
        "Se n\u00e3o houver forma de pagamento expl\u00edcita, retorne paymentMethod como null. Nunca invente t\u00edtulo, valor, data, tipo ou forma de pagamento ausentes.",
      prompt: `Hoje \u00e9 ${new Date().toISOString().slice(0, 10)}.\n\nExtraia os lan\u00e7amentos deste texto:\n\n${text}`,
      }),
      TIMEOUT_MS,
    );

    const valid: AiTransaction[] = [];

    for (const item of object.transactions.slice(0, MAX_ITEMS)) {
      const parsed = aiDraftSchema.safeParse(normalizeExtractedItem(item));
      if (
        parsed.success &&
        (parsed.data.dueDate === null || isRealDate(parsed.data.dueDate)) &&
        (parsed.data.title === null || !isIgnoredExtractedTitle(parsed.data.title))
      ) {
        valid.push(parsed.data);
      }
    }

    const fallback = tableFallback.length > 0 ? tableFallback : fallbackExtractTransactions(text);
    if (fallback.length > valid.length) {
      return {
        success: true,
        data: {
          transactions: fallback,
          discarded: Math.max(object.transactions.length - valid.length, 0),
        },
      };
    }

    if (valid.length === 0) {
      return {
        success: false,
        message: "A IA n\u00e3o encontrou lan\u00e7amentos v\u00e1lidos neste texto.",
      };
    }

    return {
      success: true,
      data: {
        transactions: valid,
        discarded: object.transactions.length - valid.length,
      },
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.message === "AI_TIMEOUT");

    const fallback = fallbackExtractTransactions(text);
    if (fallback.length > 0) {
      return {
        success: true,
        data: {
          transactions: fallback,
          discarded: 0,
        },
      };
    }

    return {
      success: false,
      message: isTimeout
        ? "A IA demorou demais para responder. Tente um texto menor ou um modelo mais r\u00e1pido."
        : "N\u00e3o foi poss\u00edvel falar com a Groq. Verifique se GROQ_API_KEY est\u00e1 configurada.",
    };
  }
}

export async function saveAiTransactionsAction(
  items: unknown,
): Promise<ActionResult<{ imported: number }>> {
  const user = await getAuthenticatedUser();

  if (!user) return { success: false, message: "Usuário não autenticado." };

  const parsed = z.array(persistedSchema).max(MAX_ITEMS).safeParse(items);

  if (!parsed.success || parsed.data.length === 0) {
    return { success: false, message: "Nenhum lan\u00e7amento v\u00e1lido para salvar." };
  }

  try {
    await prisma.$transaction(
      parsed.data.map((item) =>
        prisma.transaction.create({
          data: {
            title: item.title,
            type: item.type,
            paymentMethod: item.paymentMethod,
            // Meio-dia UTC, mesma convencao do resto do sistema.
            dueDate: new Date(`${item.dueDate}T12:00:00.000Z`),
            amount: item.amount.toFixed(2),
            isPaid: item.type === "INCOME",
            userId: user.id,
          },
        }),
      ),
    );

    revalidatePath("/");
    revalidatePath("/projection");

    return { success: true, data: { imported: parsed.data.length } };
  } catch {
    return {
      success: false,
      message: "Falha ao gravar. Nenhum lan\u00e7amento foi importado.",
    };
  }
}
