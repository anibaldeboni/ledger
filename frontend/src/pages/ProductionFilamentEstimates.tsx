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
    <div className="production-estimated-filaments">
      <p className="production-estimated-filaments-title">{label}</p>
      {filaments?.length ? (
        <ul className="production-filament-estimates" aria-label={label}>
          {filaments.map((filament, index) => (
            <li key={`${filament.filamentId}:${index}`}>
              <span>{filament.name}</span>
              <span>
                {filament.weightG.toLocaleString(locale, { maximumFractionDigits: 1 })} g · {filament.printTimeHours.toLocaleString(locale, { maximumFractionDigits: 2 })} h
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{emptyLabel}</p>
      )}
    </div>
  );
}
