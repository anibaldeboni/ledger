export function filterByName<T>(items: T[], term: string, getName: (item: T) => string): T[] {
  const needle = normalize(term.trim());
  if (needle.length < 3) return items;
  return items.filter((item) => normalize(getName(item)).includes(needle));
}

export function filterQuotesByName<T extends { name: string }>(quotes: T[], term: string): T[] {
  return filterByName(quotes, term, (quote) => quote.name);
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
