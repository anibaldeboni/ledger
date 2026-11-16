import type { ProductionFilamentUsage } from "../../bindings/ledger/internal/domain/models";

export default function ProductionFilamentEstimates({
  filaments,
  locale,
  label,
  emptyLabel,
}: {
  filaments: ProductionFilamentUsage[] | null;
  locale: string;
  label: string;
  emptyLabel: string;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {filaments?.length ? (
        <ul className="grid gap-1 text-xs" aria-label={label}>
          {filaments.map((filament, index) => (
            <li className="flex justify-between gap-3" key={`${filament.filamentId}:${index}`}>
              <span className="min-w-0 break-words">{filament.name}</span>
              <span className="shrink-0 tabular-nums">
                {filament.weightG.toLocaleString(locale, { maximumFractionDigits: 1 })} g · {filament.printTimeHours.toLocaleString(locale, { maximumFractionDigits: 2 })} h
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
