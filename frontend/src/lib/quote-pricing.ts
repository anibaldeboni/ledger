export function marginPercentFromPrice(
  totalCost: number,
  salePrice: number,
): number | null {
  if (
    !Number.isFinite(totalCost) ||
    !Number.isFinite(salePrice) ||
    salePrice <= 0
  ) {
    return null;
  }
  return ((salePrice - totalCost) / salePrice) * 100;
}
