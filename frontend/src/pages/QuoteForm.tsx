import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LedgerService } from "../../bindings/ledger";
import {
  type CostCategory,
  type Costs,
  type Filament,
  type Printer,
  type QuoteEditor,
  type Tariff,
} from "../../bindings/ledger/internal/domain/models";
import { brl } from "../lib/format";
import { parseNum } from "../lib/format";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import { isValidPrintDuration } from "../lib/print-time";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

/** Um "plate": filamento + tempo + peso. */
type PlateForm = { filamentId: number; time: string; weight: string };
type FixedForm = { categoryId: number; value: string };

const emptyPlate: PlateForm = { filamentId: 0, time: "", weight: "" };

export default function QuoteForm({
  quoteId,
  onBack,
}: {
  quoteId?: number;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const lists = useAsync(
    () =>
      Promise.all([
        LedgerService.ListPrinters(),
        LedgerService.ListTariffs(),
        LedgerService.ListFilaments(),
        LedgerService.ListCostCategories(),
      ] as const),
    [],
  );
  const editing = useAsync(
    () => (quoteId ? LedgerService.GetQuote(quoteId) : Promise.resolve(null)),
    [quoteId],
  );
  const [actionError, setActionError, clearError] = useActionError();
  const { busy, run: runExclusive } = useSubmission();

  const [name, setName] = useState("");
  const [printerId, setPrinterId] = useState(0);
  const [tariffId, setTariffId] = useState(0);
  const [margin, setMargin] = useState("");
  const [plates, setPlates] = useState<PlateForm[]>([{ ...emptyPlate }]);
  const [fixed, setFixed] = useState<FixedForm[]>([]);
  const [result, setResult] = useState<Costs | null>(null);
  const [newCat, setNewCat] = useState({ name: "", value: "" });

  // Pré-preenche a partir do orçamento carregado (edição).
  useEffect(() => {
    const q = editing.data;
    if (!q) return;
    setName(q.name);
    setPrinterId(q.printerId);
    setTariffId(q.tariffId);
    setMargin(String(q.marginPercent));
    setPlates(
      (q.filaments ?? []).map((f) => ({
        filamentId: f.filamentId,
        time: f.printTime,
        weight: String(f.weightG),
      })),
    );
    setFixed(
      (q.fixedCosts ?? []).map((c) => ({
        categoryId: c.categoryId,
        value: String(c.value),
      })),
    );
  }, [editing.data]);

  const printers = lists.data?.[0] ?? [];
  const tariffs = lists.data?.[1] ?? [];
  const filaments = lists.data?.[2] ?? [];
  const categories = lists.data?.[3] ?? [];

  // Validação (S8) derivada do estado, sem efeitos.
  const platesValid =
    plates.length > 0 &&
    plates.every(
      (p) =>
        p.filamentId > 0 &&
        isValidPrintDuration(p.time) &&
        (parseNum(p.weight) ?? 0) > 0,
    );
  const marginNum = parseNum(margin);
  const valid =
    printerId > 0 &&
    tariffId > 0 &&
    platesValid &&
    marginNum !== null &&
    marginNum > 0 &&
    marginNum < 100;

  function buildQuote(): QuoteEditor {
    return {
      id: quoteId ?? 0,
      name: name.trim(),
      printerId,
      tariffId,
      marginPercent: marginNum ?? 0,
      filaments: plates.map((p) => ({
        filamentId: p.filamentId,
        printTime: p.time,
        weightG: parseNum(p.weight) ?? 0,
      })),
      fixedCosts: fixed.map((f) => ({
        categoryId: f.categoryId,
        value: parseNum(f.value) ?? 0,
      })),
      finalPrice: 0,
      createdAt: "",
      updatedAt: "",
    };
  }

  async function calculate() {
    await runExclusive(async () => {
      clearError();
      try {
        setResult(await LedgerService.CalculateQuote(buildQuote()));
      } catch (e) {
        setActionError(e);
      }
    });
  }

  async function save() {
    await runExclusive(async () => {
      clearError();
      try {
        await LedgerService.SaveQuote(buildQuote());
        onBack();
      } catch (e) {
        setActionError(e);
      }
    });
  }

  async function createCategory() {
    if (!newCat.name.trim()) return;
    await runExclusive(async () => {
      clearError();
      try {
        const saved = await LedgerService.SaveCostCategory({
          id: 0,
          name: newCat.name.trim(),
          defaultValue: parseNum(newCat.value) ?? 0,
        });
        setFixed((f) => [
          ...f,
          { categoryId: saved.id, value: newCat.value || "0" },
        ]);
        setNewCat({ name: "", value: "" });
        lists.reload();
      } catch (e) {
        setActionError(e);
      }
    });
  }

  function pickCategory(i: number, categoryId: number) {
    const cat = categories.find((c) => c.id === categoryId);
    setFixed((f) =>
      f.map((row, j) =>
        j === i
          ? {
              categoryId,
              value:
                row.value === "" && cat ? String(cat.defaultValue) : row.value,
            }
          : row,
      ),
    );
  }

  const filById = new Map(filaments.map((f) => [f.id, f]));
  const canSave = valid && name.trim() !== "";

  return (
    <div>
      <div className="page-head">
        <h1>{quoteId ? t("quoteForm.title.edit") : t("quoteForm.title.new")}</h1>
        <button className="btn btn-icon" aria-label={t("common.back")} onClick={onBack}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      </div>

      {lists.error ? <p className="error-text">{lists.error}</p> : null}
      {editing.error ? <p className="error-text">{editing.error}</p> : null}
      {actionError ? <p className="error-text">{actionError}</p> : null}

      <section className="block">
        <h2>{t("quoteForm.sections.printerAndEnergy")}</h2>
        <div className="row">
          <label className="field">
            {t("quoteForm.fields.printer")}
            <select
              value={printerId}
              onChange={(e) => setPrinterId(Number(e.target.value))}
            >
              <option value={0}>{t("common.select")}</option>
              {printers.map((p: Printer) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.powerWatts} W
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("quoteForm.fields.tariff")}
            <select
              value={tariffId}
              onChange={(e) => setTariffId(Number(e.target.value))}
            >
              <option value={0}>{t("common.select")}</option>
              {tariffs.map((t: Tariff) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {brl(t.kwhPrice, locale)}/kWh
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="block">
        <h2>{t("quoteForm.sections.filaments")}</h2>
        {plates.map((p, i) => {
          const fil = filById.get(p.filamentId);
          const printTimeValid = isValidPrintDuration(p.time);
          const bad =
            p.filamentId === 0 ||
            (p.time !== "" && !printTimeValid) ||
            (p.weight !== "" && (parseNum(p.weight) ?? 0) <= 0);
          const invalidTime = bad && !printTimeValid;
          return (
            <div className="plate-row" key={i}>
              <div className="plate-picker">
                <span
                  className="chip"
                  style={fil?.color ? { background: fil.color } : undefined}
                  aria-hidden="true"
                />
                <select
                  value={p.filamentId}
                  className={p.filamentId === 0 ? "invalid" : undefined}
                  onChange={(e) =>
                    setPlates((ps) =>
                      ps.map((row, j) =>
                        j === i
                          ? { ...row, filamentId: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                >
                  <option value={0}>{t("quoteForm.options.chooseFilament")}</option>
                  {filaments.map((f: Filament) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.material ? ` · ${f.material}` : ""} ·{" "}
                      {brl(f.pricePerKg, locale)}/kg
                    </option>
                  ))}
                </select>
              </div>
              <label className="field">
                {t("quoteForm.fields.duration")}
                <input
                  className={invalidTime ? "invalid" : undefined}
                  aria-invalid={invalidTime}
                  value={p.time}
                  placeholder="1h57m"
                  title={t("quoteForm.printTimeHint")}
                  spellCheck={false}
                  onChange={(e) =>
                    setPlates((ps) =>
                      ps.map((row, j) =>
                        j === i ? { ...row, time: e.target.value } : row,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                {t("quoteForm.fields.weight")}
                <input
                  inputMode="decimal"
                  className={
                    bad && (parseNum(p.weight) ?? 0) <= 0
                      ? "invalid"
                      : undefined
                  }
                  value={p.weight}
                  placeholder="35"
                  onChange={(e) =>
                    setPlates((ps) =>
                      ps.map((row, j) =>
                        j === i ? { ...row, weight: e.target.value } : row,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="btn btn-danger btn-icon"
                aria-label={t("quoteForm.removeFilament")}
                title={t("quoteForm.removeFilament")}
                onClick={() => setPlates((ps) => ps.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button
            className="btn btn-primary btn-icon"
            aria-label={t("quoteForm.addFilament")}
            title={t("quoteForm.addFilament")}
            onClick={() => setPlates((ps) => [...ps, { ...emptyPlate }])}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          {plates.length === 0 ? (
            <p className="hint">{t("quoteForm.needFilament")}</p>
          ) : null}
        </div>
      </section>

      <section className="block">
        <h2>{t("quoteForm.sections.fixedCosts")}</h2>
        {fixed.map((f, i) => (
          <div
            className="plate-row"
            key={i}
            style={{ gridTemplateColumns: "1fr 130px auto", alignItems: "end" }}
          >
            <select
              value={f.categoryId}
              onChange={(e) => pickCategory(i, Number(e.target.value))}
            >
              <option value={0}>{t("quoteForm.options.chooseCategory")}</option>
              {categories.map((c: CostCategory) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="field">
              {t("quoteForm.fields.fixedCost")}
              <input
                inputMode="decimal"
                value={f.value}
                placeholder="0"
                onChange={(e) =>
                  setFixed((fs) =>
                    fs.map((row, j) =>
                      j === i ? { ...row, value: e.target.value } : row,
                    ),
                  )
                }
              />
            </label>
            <button
              className="btn btn-danger btn-icon"
              aria-label={t("quoteForm.removeCost")}
              title={t("quoteForm.removeCost")}
              onClick={() => setFixed((fs) => fs.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn btn-primary btn-icon"
            title={t("quoteForm.addCost")}
            aria-label={t("quoteForm.addCost")}
            onClick={() =>
              setFixed((fs) => [...fs, { categoryId: 0, value: "" }])
            }
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          className="row"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          <label className="field">
            {t("quoteForm.fields.newCategory")}
            <input
              value={newCat.name}
              placeholder={t("quoteForm.placeholders.newCategory")}
              onChange={(e) =>
                setNewCat((c) => ({ ...c, name: e.target.value }))
              }
            />
          </label>
          <label className="field" style={{ flexBasis: 120 }}>
            {t("quoteForm.fields.defaultValue")}
            <input
              inputMode="decimal"
              value={newCat.value}
              placeholder="0"
              onChange={(e) =>
                setNewCat((c) => ({ ...c, value: e.target.value }))
              }
            />
          </label>
          <button
            className="btn btn-sm"
            onClick={createCategory}
            disabled={!newCat.name.trim() || busy}
          >
            {t("quoteForm.createAndAddCategory")}
          </button>
        </div>
      </section>

      <section className="block">
        <h2>{t("quoteForm.sections.profitMargin")}</h2>
        <div className="row">
          <label className="field" style={{ flexBasis: 200 }}>
            {t("quoteForm.fields.margin")}
            <input
              inputMode="decimal"
              value={margin}
              placeholder={t("quoteForm.placeholders.margin")}
              onChange={(e) => setMargin(e.target.value)}
            />
          </label>
          <p className="hint">{t("quoteForm.finalPriceFormula")}</p>
        </div>
      </section>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          disabled={!valid || busy}
          onClick={calculate}
        >
          {t("quoteForm.calculate")}
        </button>
        {!valid ? (
          <p className="hint">
            {t("quoteForm.requiredFields")}
          </p>
        ) : null}
      </div>

      {result ? (
        <section className="result">
          <div className="result-line">
            <span>{t("quoteForm.result.filament")}</span>
            <strong>{brl(result.filament, locale)}</strong>
          </div>
          <div className="result-line">
            <span>{t("quoteForm.result.energy")}</span>
            <strong>{brl(result.energy, locale)}</strong>
          </div>
          <div className="result-line">
            <span>{t("quoteForm.result.amortization")}</span>
            <strong>{brl(result.amortization, locale)}</strong>
          </div>
          <div className="result-line">
            <span>{t("quoteForm.result.fixedCosts")}</span>
            <strong>{brl(result.fixedCosts, locale)}</strong>
          </div>
          <div className="result-line">
            <span>{t("quoteForm.result.totalCost")}</span>
            <strong>{brl(result.totalCost, locale)}</strong>
          </div>
          <div className="result-line">
            <span>{t("quoteForm.result.profit")}</span>
            <strong>{brl(result.profit, locale)}</strong>
          </div>
          <div className="result-final">
            <span>{t("quoteForm.result.finalPrice")}</span>
            <span className="value">{brl(result.finalPrice, locale)}</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <label className="field" style={{ flexBasis: 260 }}>
              {t("quoteForm.fields.quoteName")}
              <input
                value={name}
                placeholder={t("quoteForm.placeholders.quoteName")}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              disabled={!canSave || busy}
              onClick={save}
            >
              {quoteId ? t("quoteForm.saveChanges") : t("quoteForm.saveQuote")}
            </button>
          </div>
          {!canSave && result ? (
            <p className="hint">{t("quoteForm.needName")}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
