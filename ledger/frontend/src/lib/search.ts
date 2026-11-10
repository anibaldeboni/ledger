// Busca por nome de orçamento: só filtra a partir de 3 caracteres, ignorando
// caixa e acentos (ex.: "geometrico" encontra "Geométrico").
export function filterQuotesByName<T extends { name: string }>(quotes: T[], term: string): T[] {
  const needle = normalize(term.trim());
  if (needle.length < 3) return quotes;
  return quotes.filter((q) => normalize(q.name).includes(needle));
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
