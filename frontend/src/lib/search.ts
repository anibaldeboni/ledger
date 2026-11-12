// Busca por nome de orçamento: só filtra a partir de 3 caracteres, ignorando
// caixa e acentos (ex.: "geometrico" encontra "Geométrico").
export function filterQuotesByName<T extends { name: string }>(quotes: T[], term: string): T[] {
  const needle = normalize(term.trim());
  if (needle.length < 3) return quotes;
  return quotes.filter((q) => normalize(q.name).includes(needle));
}

export type QuoteSort = { key: "name" | "updated"; dir: "asc" | "desc" };

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

// Ordena sem alterar a lista original; nome segue o alfabeto pt-BR.
export function sortQuotes<T extends { name: string; updatedAt: string }>(quotes: T[], sort: QuoteSort): T[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...quotes].sort((a, b) =>
    sort.key === "name"
      ? dir * collator.compare(a.name, b.name)
      : dir * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)),
  );
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
