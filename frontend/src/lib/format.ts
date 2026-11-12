// Formatação e parse numérico pt-BR (aceita vírgula decimal nos inputs).
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "" || isNaN(Number(t))) return null;
  return Number(t);
}

export function brl(n: number, locale = "pt-BR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
  }).format(n);
}

export function num(n: number, digits = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// "2026-11-06T14:30:00Z" → "06/11/2026 14:30"
export function dt(iso: string, locale = "pt-BR"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}
