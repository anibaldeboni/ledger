import { useEffect, useState } from "react";
import { LedgerService } from "../../bindings/ledger";
import {
  type CostCategory,
  type Costs,
  type Filament,
  type Printer,
  type Quote,
  type Tariff,
} from "../../bindings/ledger/internal/domain/models";
import { brl } from "../lib/format";
import { parseNum } from "../lib/format";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";

/** Um "plate": filamento + tempo + peso. */
type PlateForm = { filamentId: number; time: string; weight: string };
type FixedForm = { categoryId: number; value: string };

const emptyPlate: PlateForm = { filamentId: 0, time: "", weight: "" };

export default function QuoteForm({ quoteId, onBack }: { quoteId?: number; onBack: () => void }) {
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
        time: String(f.printTimeHours),
        weight: String(f.weightG),
      })),
    );
    setFixed((q.fixedCosts ?? []).map((c) => ({ categoryId: c.categoryId, value: String(c.value) })));
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
        (parseNum(p.time) ?? 0) > 0 &&
        (parseNum(p.weight) ?? 0) > 0,
    );
  const marginNum = parseNum(margin);
  const valid =
    printerId > 0 && tariffId > 0 && platesValid && marginNum !== null && marginNum > 0 && marginNum < 100;

  function buildQuote(): Quote {
    return {
      id: quoteId ?? 0,
      name: name.trim(),
      printerId,
      tariffId,
      marginPercent: marginNum ?? 0,
      filaments: plates.map((p) => ({
        filamentId: p.filamentId,
        printTimeHours: parseNum(p.time) ?? 0,
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
        setFixed((f) => [...f, { categoryId: saved.id, value: newCat.value || "0" }]);
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
          ? { categoryId, value: row.value === "" && cat ? String(cat.defaultValue) : row.value }
          : row,
      ),
    );
  }

  const filById = new Map(filaments.map((f) => [f.id, f]));
  const canSave = valid && name.trim() !== "";

  return (
    <div>
      <div className="page-head">
        <h1>{quoteId ? "Editar orçamento" : "Novo orçamento"}</h1>
        <button className="btn" onClick={onBack}>
          Voltar
        </button>
      </div>

      {lists.error ? <p className="error-text">{lists.error}</p> : null}
      {editing.error ? <p className="error-text">{editing.error}</p> : null}
      {actionError ? <p className="error-text">{actionError}</p> : null}

      <section className="block">
        <h2>Impressora e energia</h2>
        <div className="row">
          <label className="field">
            Impressora
            <select value={printerId} onChange={(e) => setPrinterId(Number(e.target.value))}>
              <option value={0}>Selecione…</option>
              {printers.map((p: Printer) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.powerWatts} W
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Bandeira tarifária
            <select value={tariffId} onChange={(e) => setTariffId(Number(e.target.value))}>
              <option value={0}>Selecione…</option>
              {tariffs.map((t: Tariff) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {brl(t.kwhPrice)}/kWh
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="block">
        <h2>Filamentos (um por cor/plate)</h2>
        {plates.map((p, i) => {
          const fil = filById.get(p.filamentId);
          const bad = p.filamentId === 0 || (p.time !== "" && (parseNum(p.time) ?? 0) <= 0) || (p.weight !== "" && (parseNum(p.weight) ?? 0) <= 0);
          return (
            <div className="plate-row" key={i}>
              <span className="chip" style={fil?.color ? { background: fil.color } : undefined} aria-hidden="true" />
              <select
                value={p.filamentId}
                className={p.filamentId === 0 ? "invalid" : undefined}
                onChange={(e) =>
                  setPlates((ps) => ps.map((row, j) => (j === i ? { ...row, filamentId: Number(e.target.value) } : row)))
                }
              >
                <option value={0}>Selecione o filamento…</option>
                {filaments.map((f: Filament) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.material ? ` · ${f.material}` : ""} · {brl(f.pricePerKg)}/kg
                  </option>
                ))}
              </select>
              <label className="field">
                Tempo (h)
                <input
                  inputMode="decimal"
                  className={bad && (parseNum(p.time) ?? 0) <= 0 ? "invalid" : undefined}
                  value={p.time}
                  placeholder="1,5"
                  onChange={(e) => setPlates((ps) => ps.map((row, j) => (j === i ? { ...row, time: e.target.value } : row)))}
                />
              </label>
              <label className="field">
                Peso (g)
                <input
                  inputMode="decimal"
                  className={bad && (parseNum(p.weight) ?? 0) <= 0 ? "invalid" : undefined}
                  value={p.weight}
                  placeholder="35"
                  onChange={(e) => setPlates((ps) => ps.map((row, j) => (j === i ? { ...row, weight: e.target.value } : row)))}
                />
              </label>
              <button
                className="btn btn-ghost"
                aria-label="Remover filamento"
                onClick={() => setPlates((ps) => ps.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          );
        })}
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn btn-sm" onClick={() => setPlates((ps) => [...ps, { ...emptyPlate }])}>
            + Adicionar filamento
          </button>
          {plates.length === 0 ? <p className="hint">Adicione ao menos um filamento.</p> : null}
        </div>
      </section>

      <section className="block">
        <h2>Custos fixos</h2>
        {fixed.map((f, i) => (
          <div className="plate-row" key={i} style={{ gridTemplateColumns: "1fr 130px auto" }}>
            <select value={f.categoryId} onChange={(e) => pickCategory(i, Number(e.target.value))}>
              <option value={0}>Selecione a categoria…</option>
              {categories.map((c: CostCategory) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="field">
              Valor (R$)
              <input
                inputMode="decimal"
                value={f.value}
                placeholder="0"
                onChange={(e) => setFixed((fs) => fs.map((row, j) => (j === i ? { ...row, value: e.target.value } : row)))}
              />
            </label>
            <button
              className="btn btn-ghost"
              aria-label="Remover custo"
              onClick={() => setFixed((fs) => fs.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button
            className="btn btn-sm"
            onClick={() => setFixed((fs) => [...fs, { categoryId: 0, value: "" }])}
          >
            + Adicionar custo
          </button>
        </div>
        <div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <label className="field">
            Nova categoria
            <input
              value={newCat.name}
              placeholder="Ex.: Pós-processamento"
              onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label className="field" style={{ flexBasis: 120 }}>
            Valor padrão (R$)
            <input
              inputMode="decimal"
              value={newCat.value}
              placeholder="0"
              onChange={(e) => setNewCat((c) => ({ ...c, value: e.target.value }))}
            />
          </label>
          <button className="btn btn-sm" onClick={createCategory} disabled={!newCat.name.trim() || busy}>
            Criar e adicionar
          </button>
        </div>
      </section>

      <section className="block">
        <h2>Margem de lucro</h2>
        <div className="row">
          <label className="field" style={{ flexBasis: 200 }}>
            Margem (%)
            <input
              inputMode="decimal"
              value={margin}
              placeholder="50"
              onChange={(e) => setMargin(e.target.value)}
            />
          </label>
          <p className="hint">Preço final = custo total ÷ (1 − margem/100).</p>
        </div>
      </section>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={calculate}>
          Calcular
        </button>
        {!valid ? <p className="hint">Preencha impressora, bandeira, ao menos um filamento (tempo e peso) e a margem.</p> : null}
      </div>

      {result ? (
        <section className="result">
          <div className="result-line">
            <span>Filamento</span>
            <strong>{brl(result.filament)}</strong>
          </div>
          <div className="result-line">
            <span>Energia</span>
            <strong>{brl(result.energy)}</strong>
          </div>
          <div className="result-line">
            <span>Amortização</span>
            <strong>{brl(result.amortization)}</strong>
          </div>
          <div className="result-line">
            <span>Custos fixos</span>
            <strong>{brl(result.fixedCosts)}</strong>
          </div>
          <div className="result-line">
            <span>Custo total</span>
            <strong>{brl(result.totalCost)}</strong>
          </div>
          <div className="result-line">
            <span>Lucro</span>
            <strong>{brl(result.profit)}</strong>
          </div>
          <div className="result-final">
            <span>Preço final</span>
            <span className="value">{brl(result.finalPrice)}</span>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <label className="field" style={{ flexBasis: 260 }}>
              Nome do orçamento
              <input value={name} placeholder="Ex.: Capivara articulada" onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={!canSave || busy} onClick={save}>
              {quoteId ? "Salvar alterações" : "Salvar orçamento"}
            </button>
          </div>
          {!canSave && result ? <p className="hint">Dê um nome ao orçamento para salvá-lo.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
