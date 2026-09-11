"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionDTO,
  type UpdateMode,
} from "@/actions/transactions";
import {
  MAX_OCCURRENCES,
  PAYMENT_METHODS,
  transactionFormSchema,
  type TransactionFormValues,
} from "@/schemas/transaction";

function todayAsInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const INSTALLMENT_SUFFIX = /\s*\(\d+\/\d+\)\s*$/;

const DEFAULT_VALUES: TransactionFormValues = {
  title: "",
  type: "EXPENSE",
  paymentMethod: PAYMENT_METHODS[0],
  dueDate: todayAsInputValue(),
  amount: 0,
  isPaid: false,
  recurrence: "SINGLE",
  frequency: "MONTHLY",
  occurrences: 1,
};

function toFormValues(transaction: TransactionDTO): TransactionFormValues {
  return {
    title: transaction.title.replace(INSTALLMENT_SUFFIX, "").trim(),
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
    dueDate: transaction.dueDate.slice(0, 10),
    amount: transaction.amount,
    isPaid: transaction.isPaid,
    recurrence: "SINGLE",
    frequency: "MONTHLY",
    occurrences: 1,
  };
}

const fieldClass =
  "h-12 w-full rounded-lg border border-[#334155] bg-[#020617] px-3 text-sm text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#10B981]";
const selectClass =
  "h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#334155] bg-[#0F172A] bg-[linear-gradient(45deg,transparent_50%,#94A3B8_50%),linear-gradient(135deg,#94A3B8_50%,transparent_50%)] bg-[position:calc(100%-18px)_20px,calc(100%-13px)_20px] bg-[size:5px_5px,5px_5px] bg-no-repeat px-4 pr-10 text-base text-[#F8FAFC] outline-none transition-colors focus:border-[#10B981] [&>option]:bg-[#172033] [&>option]:text-[#F8FAFC]";
const labelClass = "mb-1.5 block text-xs font-medium text-[#94A3B8]";
const errorClass = "mt-1 text-xs text-[#F87171]";

export function TransactionForm({
  initialData,
  open: openProp,
  onClose,
}: {
  initialData?: TransactionDTO;
  open?: boolean;
  onClose?: () => void;
}) {
  const isEditing = initialData !== undefined;
  const isControlled = openProp !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("SINGLE");

  const isOpen = isControlled ? openProp : internalOpen;
  const belongsToSeries = initialData?.groupId != null;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: initialData ? toFormValues(initialData) : DEFAULT_VALUES,
  });

  const recurrence = useWatch({ control, name: "recurrence" });
  const isSeries = recurrence !== "SINGLE";

  function close() {
    setFormError(null);

    if (isControlled) {
      onClose?.();
      return;
    }

    setInternalOpen(false);
    reset(DEFAULT_VALUES);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const result = isEditing
      ? await updateTransactionAction(initialData.id, values, updateMode)
      : await createTransactionAction(values);

    if (!result.success) {
      setFormError(result.message);
      toast.error(result.message);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) {
          setError(field as keyof TransactionFormValues, {
            message: messages[0],
          });
        }
      }
      return;
    }

    if (isEditing) {
      toast.success(
        updateMode === "FUTURE"
          ? `"${values.title}" atualizado nesta e nas próximas ocorrências`
          : `"${values.title}" atualizado`,
      );
      close();
      return;
    }

    const total = values.recurrence === "SINGLE" ? 1 : values.occurrences;
    toast.success(
      total > 1
        ? `${total} lançamentos criados para "${values.title}"`
        : `"${values.title}" cadastrado`,
    );

    reset(DEFAULT_VALUES);
    setInternalOpen(false);
  });

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#10B981] px-3 text-[13px] font-bold text-[#020617] transition-colors hover:bg-[#34D399] lg:h-9 lg:w-auto lg:px-4"
        >
          <Plus className="size-4" aria-hidden />
          Novo lançamento
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-form-title"
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#334155] bg-[#172033] p-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="transaction-form-title"
                  className="font-outfit text-2xl font-bold text-[#F8FAFC]"
                >
                  {isEditing ? "Editar lançamento" : "Novo lançamento"}
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  {isEditing
                    ? "Altere os dados e salve as mudanças."
                    : "Cadastre uma receita ou despesa do mês."}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-[#0F172A] hover:text-[#F8FAFC]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="title">
                  Título
                </label>
                <input
                  id="title"
                  className={fieldClass}
                  placeholder="Ex.: Financiamento do apê"
                  {...register("title")}
                />
                {errors.title && (
                  <p className={errorClass}>{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="type">
                    Tipo
                  </label>
                  <select id="type" className={selectClass} {...register("type")}>
                    <option value="EXPENSE">Despesa</option>
                    <option value="INCOME">Receita</option>
                  </select>
                  {errors.type && (
                    <p className={errorClass}>{errors.type.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="paymentMethod">
                    Forma de pagamento
                  </label>
                  <select
                    id="paymentMethod"
                    className={selectClass}
                    {...register("paymentMethod")}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  {errors.paymentMethod && (
                    <p className={errorClass}>{errors.paymentMethod.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="dueDate">
                    Vencimento
                  </label>
                  <input
                    id="dueDate"
                    type="date"
                    className={fieldClass}
                    {...register("dueDate")}
                  />
                  {errors.dueDate && (
                    <p className={errorClass}>{errors.dueDate.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="amount">
                    Valor (R$)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className={fieldClass}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  {errors.amount && (
                    <p className={errorClass}>{errors.amount.message}</p>
                  )}
                </div>
              </div>

              {isEditing ? (
                belongsToSeries && (
                  <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <legend className="px-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      Aplicar alteração em
                    </legend>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="updateMode"
                          value="SINGLE"
                          checked={updateMode === "SINGLE"}
                          onChange={() => setUpdateMode("SINGLE")}
                          className="mt-0.5 size-4 accent-emerald-500"
                        />
                        Somente esta ocorrência
                      </label>
                      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="updateMode"
                          value="FUTURE"
                          checked={updateMode === "FUTURE"}
                          onChange={() => setUpdateMode("FUTURE")}
                          className="mt-0.5 size-4 accent-emerald-500"
                        />
                        Esta e as próximas ocorrências
                      </label>
                    </div>

                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                      Vencimento e status de pagamento são sempre individuais e
                      não se propagam para as outras ocorrências.
                    </p>
                  </fieldset>
                )
              ) : (
                <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <legend className="px-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                    Repetição
                  </legend>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "SINGLE", label: "Único" },
                        { value: "INSTALLMENT", label: "Parcelado" },
                        { value: "FIXED", label: "Fixo" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setValue("recurrence", option.value);
                          setValue(
                            "occurrences",
                            option.value === "SINGLE" ? 1 : 12,
                          );
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          recurrence === option.value
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {isSeries && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass} htmlFor="occurrences">
                          {recurrence === "INSTALLMENT"
                            ? "Nº de parcelas"
                            : "Repetir por (vezes)"}
                        </label>
                        <input
                          id="occurrences"
                          type="number"
                          min="2"
                          max={MAX_OCCURRENCES}
                          className={fieldClass}
                          {...register("occurrences", { valueAsNumber: true })}
                        />
                        {errors.occurrences && (
                          <p className={errorClass}>
                            {errors.occurrences.message}
                          </p>
                        )}
                      </div>

                      {recurrence === "FIXED" && (
                        <div>
                          <label className={labelClass} htmlFor="frequency">
                            Periodicidade
                          </label>
                          <select
                            id="frequency"
                            className={selectClass}
                            {...register("frequency")}
                          >
                            <option value="MONTHLY">Mensal</option>
                            <option value="YEARLY">Anual</option>
                          </select>
                          {errors.frequency && (
                            <p className={errorClass}>
                              {errors.frequency.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
                    {recurrence === "INSTALLMENT"
                      ? "Informe o valor de cada parcela. O título recebe o sufixo (1/12)."
                      : recurrence === "FIXED"
                        ? "Gera as próximas ocorrências com o mesmo valor e dia de vencimento."
                        : "Lançamento avulso, sem repetição."}
                  </p>
                </fieldset>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="size-4 accent-emerald-500"
                  {...register("isPaid")}
                />
                Já foi pago
              </label>

              {formError && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-[#334155] bg-[#0F172A] px-4 py-2 text-sm font-semibold text-[#F8FAFC] transition-colors hover:bg-[#020617]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-gradient-to-r from-[#0FBA82] to-[#33D499] px-4 py-2 text-sm font-bold text-[#020617] shadow-[0_10px_24px_-8px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Salvando..."
                    : isEditing
                      ? "Salvar alterações"
                      : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
