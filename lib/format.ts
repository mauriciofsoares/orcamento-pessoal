export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// As datas são gravadas ao meio-dia UTC; formatar em UTC evita deslocar o dia.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(isoDate));
}

// Aceita "1.234,56" (pt-BR) e "1234.56"; retorna null quando nao ha numero valido.
export function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
