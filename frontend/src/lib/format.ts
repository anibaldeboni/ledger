// Formatação e parse numérico pt-BR (aceita vírgula decimal nos inputs).
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "" || isNaN(Number(t))) return null;
  return Number(t);
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function brl(n: number): string {
  return brlFmt.format(n);
}

export function num(n: number, digits = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// "2026-11-06T14:30:00Z" → "06/11/2026 14:30"
export function dt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
