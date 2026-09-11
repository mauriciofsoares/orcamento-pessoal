import { z } from "zod";

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;

export const PAYMENT_METHODS = [
  "Boleto",
  "Pix",
  "Débito em conta",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Transferência",
  "Outro",
] as const;

export const RECURRENCE_TYPES = ["SINGLE", "INSTALLMENT", "FIXED"] as const;
export const RECURRENCE_FREQUENCIES = ["MONTHLY", "YEARLY"] as const;

export const MAX_OCCURRENCES = 120;

const transactionBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "O título precisa ter pelo menos 3 caracteres")
    .max(120, "O título pode ter no máximo 120 caracteres"),

  type: z.enum(TRANSACTION_TYPES, {
    message: "Selecione se é receita ou despesa",
  }),

  paymentMethod: z
    .string()
    .trim()
    .min(2, "Informe a forma de pagamento")
    .max(60, "Forma de pagamento muito longa"),

  // O input type="date" envia "YYYY-MM-DD"; interpretamos como meio-dia UTC para que
  // a data nunca "volte um dia" ao ser exibida no fuso de São Paulo (UTC-3).
  dueDate: z
    .union([z.string(), z.date()])
    .transform((value, ctx) => {
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          ctx.addIssue({ code: "custom", message: "Data de vencimento inválida" });
          return z.NEVER;
        }
        return value;
      }

      const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
      const parsed = isoDateOnly.test(value)
        ? new Date(`${value}T12:00:00.000Z`)
        : new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: "custom", message: "Data de vencimento inválida" });
        return z.NEVER;
      }

      return parsed;
    }),

  amount: z.coerce
    .number({ message: "Informe um valor numérico" })
    .positive("O valor precisa ser maior que zero")
    .max(99_999_999.99, "Valor acima do limite suportado")
    // Decimal(12,2) no banco: arredondamos para 2 casas antes de persistir.
    .transform((value) => Math.round(value * 100) / 100),

  isPaid: z.boolean().default(false),

  recurrence: z.enum(RECURRENCE_TYPES).default("SINGLE"),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  occurrences: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_OCCURRENCES, `No máximo ${MAX_OCCURRENCES} ocorrências por vez`)
    .default(1),
  initialInstallment: z.coerce
    .number()
    .int("Use um número inteiro")
    .min(1, "A parcela atual deve ser no mínimo 1")
    .max(MAX_OCCURRENCES, `No máximo ${MAX_OCCURRENCES} parcelas`)
    .default(1),
});

function validateRecurrence(
  data: {
    recurrence: string;
    frequency?: string;
    occurrences: number;
    initialInstallment?: number;
  },
  ctx: z.RefinementCtx,
) {
  if (data.recurrence === "SINGLE") return;

  if (data.occurrences < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["occurrences"],
      message: "Informe pelo menos 2 ocorrências",
    });
  }

  if (
    data.recurrence === "INSTALLMENT" &&
    typeof data.initialInstallment === "number" &&
    data.initialInstallment > data.occurrences
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["initialInstallment"],
      message: "A parcela atual não pode ser maior que o número de parcelas",
    });
  }

  if (data.recurrence === "FIXED" && !data.frequency) {
    ctx.addIssue({
      code: "custom",
      path: ["frequency"],
      message: "Selecione a periodicidade",
    });
  }
}

export const transactionSchema =
  transactionBaseSchema.superRefine(validateRecurrence);
// Espelho do transactionSchema sem transforms, para o react-hook-form: aqui os tipos
// de entrada e saída são idênticos, o que mantém a tipagem dos campos simples.
export const transactionFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "O título precisa ter pelo menos 3 caracteres")
    .max(120, "O título pode ter no máximo 120 caracteres"),
  type: z.enum(TRANSACTION_TYPES, { message: "Selecione o tipo" }),
  paymentMethod: z.string().trim().min(2, "Informe a forma de pagamento"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de vencimento"),
  amount: z
    .number({ message: "Informe um valor" })
    .positive("O valor precisa ser maior que zero")
    .max(99_999_999.99, "Valor acima do limite suportado"),
  isPaid: z.boolean(),
  recurrence: z.enum(RECURRENCE_TYPES),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  occurrences: z
    .number({ message: "Informe a quantidade" })
    .int("Use um número inteiro")
    .min(1)
    .max(MAX_OCCURRENCES, `No máximo ${MAX_OCCURRENCES} ocorrências por vez`),
  initialInstallment: z
    .number({ message: "Informe a parcela atual" })
    .int("Use um número inteiro")
    .min(1, "A parcela atual deve ser no mínimo 1")
    .max(MAX_OCCURRENCES, `No máximo ${MAX_OCCURRENCES} parcelas`),
}).superRefine(validateRecurrence);

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export const updateTransactionSchema = transactionBaseSchema
  .partial()
  .extend({
    id: z.uuid("Identificador inválido"),
  });

export const transactionFiltersSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  isPaid: z.boolean().optional(),
});

export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionData = z.output<typeof transactionSchema>;
export type TransactionFilters = z.output<typeof transactionFiltersSchema>;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];
