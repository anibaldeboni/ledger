import { useState } from "react";
import {
  Check,
  CloudSync,
  Pencil,
  PhoneOutgoing,
  Save,
  Trash2,
} from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import { brl, parseNum } from "../lib/format";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";

/** Exclusão em dois passos, sem diálogo nativo. */
function DeleteButton({
  onConfirm,
  item,
}: {
  onConfirm: () => void;
  item: string;
}) {
  const [armed, setArmed] = useState(false);
  const label = armed ? `Confirmar exclusão: ${item}` : `Excluir ${item}`;
  return (
    <button
      type="button"
      className="btn btn-danger btn-icon"
      aria-label={label}
      title={label}
      onClick={() => {
        if (armed) onConfirm();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? (
        <Check size={16} aria-hidden="true" />
      ) : (
        <Trash2 size={16} aria-hidden="true" />
      )}
    </button>
  );
}

export default function Settings() {
  const [filamentsRefreshKey, setFilamentsRefreshKey] = useState(0);
  return (
    <div>
      <div className="page-head">
        <h1>Configurações</h1>
      </div>
      <PrintersSection />
      <TariffsSection />
      <FilamentsSection refreshKey={filamentsRefreshKey} />
      <SpoolmanSection
        onImported={() => setFilamentsRefreshKey((key) => key + 1)}
      />
      <CostCategoriesSection />
    </div>
  );
}

// --- Impressoras (S1) ----------------------------------------------------------

function PrintersSection() {
  const list = useAsync(() => LedgerService.ListPrinters(), []);
  const [form, setForm] = useState({
    id: 0,
    name: "",
    purchase: "",
    resale: "",
    lifespan: "",
    watts: "",
  });
  const [err, setErr, clearErr] = useActionError();
  const { busy, run } = useSubmission();
  const editing = form.id !== 0;

  async function save() {
    await run(async () => {
      clearErr();
      try {
        await LedgerService.SavePrinter({
          id: form.id,
          name: form.name.trim(),
          purchasePrice: parseNum(form.purchase) ?? 0,
          resalePrice: parseNum(form.resale) ?? 0,
          lifespanHours: parseNum(form.lifespan) ?? 0,
          powerWatts: parseNum(form.watts) ?? 0,
        });
        setForm({
          id: 0,
          name: "",
          purchase: "",
          resale: "",
          lifespan: "",
          watts: "",
        });
        list.reload();
      } catch (e) {
        setErr(e);
      }
    });
  }

  async function remove(id: number) {
    clearErr();
    try {
      await LedgerService.DeletePrinter(id);
      list.reload();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <section className="block">
      <h2>Impressoras</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">Nenhuma impressora cadastrada.</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-printer">
            <span>Nome</span>
            <span className="money">Compra</span>
            <span className="money">Revenda</span>
            <span className="money">Vida útil (h)</span>
            <span className="money">Potência (W)</span>
            <span />
          </div>
          {(list.data ?? []).map((p) => (
            <div className="list-row cols-printer" key={p.id}>
              <span>{p.name}</span>
              <span className="money">{brl(p.purchasePrice)}</span>
              <span className="money">{brl(p.resalePrice)}</span>
              <span className="money">
                {p.lifespanHours.toLocaleString("pt-BR")}
              </span>
              <span className="money">
                {p.powerWatts.toLocaleString("pt-BR")}
              </span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Editar impressora ${p.name}`}
                  title={`Editar impressora ${p.name}`}
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      purchase: String(p.purchasePrice),
                      resale: String(p.resalePrice),
                      lifespan: String(p.lifespanHours),
                      watts: String(p.powerWatts),
                    })
                  }
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <DeleteButton
                  item={`impressora ${p.name}`}
                  onConfirm={() => remove(p.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          Nome
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Bambu A1"
          />
        </label>
        <label className="field">
          Preço de compra (R$)
          <input
            inputMode="decimal"
            value={form.purchase}
            onChange={(e) => setForm({ ...form, purchase: e.target.value })}
            placeholder="4500"
          />
        </label>
        <label className="field">
          Revenda (R$)
          <input
            inputMode="decimal"
            value={form.resale}
            onChange={(e) => setForm({ ...form, resale: e.target.value })}
            placeholder="500"
          />
        </label>
        <label className="field">
          Vida útil (h)
          <input
            inputMode="decimal"
            value={form.lifespan}
            onChange={(e) => setForm({ ...form, lifespan: e.target.value })}
            placeholder="5000"
          />
        </label>
        <label className="field">
          Potência (W)
          <input
            inputMode="decimal"
            value={form.watts}
            onChange={(e) => setForm({ ...form, watts: e.target.value })}
            placeholder="250"
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy}
            onClick={save}
          >
            {busy ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
          </button>
          {editing ? (
            <button
              className="btn"
              onClick={() =>
                setForm({
                  id: 0,
                  name: "",
                  purchase: "",
                  resale: "",
                  lifespan: "",
                  watts: "",
                })
              }
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Bandeiras tarifárias (S2) -------------------------------------------------

function TariffsSection() {
  const list = useAsync(() => LedgerService.ListTariffs(), []);
  const [form, setForm] = useState({ id: 0, name: "", kwh: "" });
  const [err, setErr, clearErr] = useActionError();
  const { busy, run } = useSubmission();

  async function save() {
    await run(async () => {
      clearErr();
      try {
        await LedgerService.SaveTariff({
          id: form.id,
          name: form.name.trim(),
          kwhPrice: parseNum(form.kwh) ?? 0,
        });
        setForm({ id: 0, name: "", kwh: "" });
        list.reload();
      } catch (e) {
        setErr(e);
      }
    });
  }

  async function remove(id: number) {
    clearErr();
    try {
      await LedgerService.DeleteTariff(id);
      list.reload();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <section className="block">
      <h2>Bandeiras tarifárias</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">Nenhuma bandeira cadastrada.</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-tariff">
            <span>Nome</span>
            <span className="money">kWh</span>
            <span />
          </div>
          {(list.data ?? []).map((t) => (
            <div className="list-row cols-tariff" key={t.id}>
              <span>{t.name}</span>
              <span className="money">{brl(t.kwhPrice)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Editar bandeira tarifária ${t.name}`}
                  title={`Editar bandeira tarifária ${t.name}`}
                  onClick={() =>
                    setForm({ id: t.id, name: t.name, kwh: String(t.kwhPrice) })
                  }
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <DeleteButton
                  item={`bandeira tarifária ${t.name}`}
                  onConfirm={() => remove(t.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          Nome
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Verde"
          />
        </label>
        <label className="field">
          Valor do kWh (R$)
          <input
            inputMode="decimal"
            value={form.kwh}
            onChange={(e) => setForm({ ...form, kwh: e.target.value })}
            placeholder="0,80"
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy}
            onClick={save}
          >
            {busy ? "Salvando…" : form.id ? "Salvar" : "Adicionar"}
          </button>
          {form.id ? (
            <button
              className="btn"
              onClick={() => setForm({ id: 0, name: "", kwh: "" })}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Filamentos (S3) -----------------------------------------------------------

function FilamentsSection({ refreshKey }: { refreshKey: number }) {
  const list = useAsync(() => LedgerService.ListFilaments(), [refreshKey]);
  const [form, setForm] = useState({
    id: 0,
    name: "",
    material: "",
    color: "#8b93a9",
    price: "",
  });
  const [err, setErr, clearErr] = useActionError();
  const { busy, run } = useSubmission();

  async function save() {
    await run(async () => {
      clearErr();
      try {
        await LedgerService.SaveFilament({
          id: form.id,
          name: form.name.trim(),
          material: form.material.trim(),
          color: form.color,
          pricePerKg: parseNum(form.price) ?? 0,
          source: "manual",
          spoolmanId: null,
        });
        setForm({ id: 0, name: "", material: "", color: "#8b93a9", price: "" });
        list.reload();
      } catch (e) {
        setErr(e);
      }
    });
  }

  async function remove(id: number) {
    clearErr();
    try {
      await LedgerService.DeleteFilament(id);
      list.reload();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <section className="block">
      <h2>Filamentos</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">
          Nenhum filamento cadastrado — crie manualmente ou importe do Spoolman
          abaixo.
        </p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-fil">
            <span />
            <span>Nome</span>
            <span>Material</span>
            <span className="money">Preço/kg</span>
            <span>Origem</span>
            <span />
          </div>
          {(list.data ?? []).map((f) => (
            <div className="list-row cols-fil" key={f.id}>
              <span
                className="chip"
                style={{ background: f.color || undefined }}
                aria-hidden="true"
              />
              <span>{f.name}</span>
              <span className="muted">{f.material || "—"}</span>
              <span className="money">{brl(f.pricePerKg)}</span>
              <span className="muted">
                {f.source === "spoolman" ? "Spoolman" : "Manual"}
              </span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Editar filamento ${f.name}`}
                  title={`Editar filamento ${f.name}`}
                  onClick={() =>
                    setForm({
                      id: f.id,
                      name: f.name,
                      material: f.material,
                      color: f.color || "#8b93a9",
                      price: String(f.pricePerKg),
                    })
                  }
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <DeleteButton
                  item={`filamento ${f.name}`}
                  onConfirm={() => remove(f.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          Nome
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: PLA Preto"
          />
        </label>
        <label className="field">
          Material
          <input
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            placeholder="PLA"
          />
        </label>
        <label className="field" style={{ flexBasis: 90 }}>
          Cor
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            style={{ padding: 3, height: 35 }}
          />
        </label>
        <label className="field">
          Preço/kg (R$)
          <input
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="99"
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy}
            onClick={save}
          >
            {busy ? "Salvando…" : form.id ? "Salvar" : "Adicionar"}
          </button>
          {form.id ? (
            <button
              className="btn"
              onClick={() =>
                setForm({
                  id: 0,
                  name: "",
                  material: "",
                  color: "#8b93a9",
                  price: "",
                })
              }
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Spoolman (S3, S4) ---------------------------------------------------------

function SpoolmanSection({ onImported }: { onImported: () => void }) {
  const config = useAsync(() => LedgerService.GetSpoolmanURL(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr, clearErr] = useActionError();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const value = url ?? config.data ?? "";

  async function persist() {
    clearErr();
    setStatus(null);
    try {
      await LedgerService.SetSpoolmanURL(value.trim());
      setUrl(value.trim());
      setStatus("URL salva.");
    } catch (e) {
      setErr(e);
    }
  }

  async function test() {
    clearErr();
    setStatus(null);
    setBusy(true);
    try {
      await LedgerService.TestSpoolman(value.trim());
      setStatus("Conexão OK.");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function importSpools() {
    clearErr();
    setStatus(null);
    setBusy(true);
    try {
      const n = await LedgerService.ImportSpoolman(value.trim());
      onImported();
      setStatus(`${n} filamento(s) importados/atualizados.`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="block">
      <h2>Spoolman</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {status ? <p className="ok-text">{status}</p> : null}
      <div className="row">
        <label className="field grow">
          URL do Spoolman
          <input
            value={value}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8000"
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-icon"
            title="Salvar"
            aria-label="Salvar"
            onClick={persist}
          >
            <Save size={22} aria-hidden="true" />
          </button>
          <button
            className="btn btn-icon"
            title="Testar conexão"
            aria-label="Testar conexão"
            disabled={busy || !value.trim()}
            onClick={test}
          >
            <PhoneOutgoing size={22} aria-hidden="true" />
          </button>
          <button
            className="btn btn-primary btn-icon"
            title="Importar spools"
            aria-label="Importar spools"
            disabled={busy || !value.trim()}
            onClick={importSpools}
          >
            <CloudSync size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="hint">
        Importar atualiza os filamentos existentes (por spool) e adiciona os
        novos; spools arquivados são ignorados.
      </p>
    </section>
  );
}

// --- Categorias de custo fixo (S5) ---------------------------------------------

function CostCategoriesSection() {
  const list = useAsync(() => LedgerService.ListCostCategories(), []);
  const [form, setForm] = useState({ id: 0, name: "", value: "" });
  const [err, setErr, clearErr] = useActionError();
  const { busy, run } = useSubmission();

  async function save() {
    await run(async () => {
      clearErr();
      try {
        await LedgerService.SaveCostCategory({
          id: form.id,
          name: form.name.trim(),
          defaultValue: parseNum(form.value) ?? 0,
        });
        setForm({ id: 0, name: "", value: "" });
        list.reload();
      } catch (e) {
        setErr(e);
      }
    });
  }

  async function remove(id: number) {
    clearErr();
    try {
      await LedgerService.DeleteCostCategory(id);
      list.reload();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <section className="block">
      <h2>Categorias de custo fixo</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">Nenhuma categoria cadastrada.</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-cat">
            <span>Nome</span>
            <span className="money">Valor padrão</span>
            <span />
          </div>
          {(list.data ?? []).map((c) => (
            <div className="list-row cols-cat" key={c.id}>
              <span>{c.name}</span>
              <span className="money">{brl(c.defaultValue)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Editar categoria de custo ${c.name}`}
                  title={`Editar categoria de custo ${c.name}`}
                  onClick={() =>
                    setForm({
                      id: c.id,
                      name: c.name,
                      value: String(c.defaultValue),
                    })
                  }
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <DeleteButton
                  item={`categoria de custo ${c.name}`}
                  onConfirm={() => remove(c.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          Nome
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Mão de Obra"
          />
        </label>
        <label className="field">
          Valor padrão (R$)
          <input
            inputMode="decimal"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="0"
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy}
            onClick={save}
          >
            {busy ? "Salvando…" : form.id ? "Salvar" : "Adicionar"}
          </button>
          {form.id ? (
            <button
              className="btn"
              onClick={() => setForm({ id: 0, name: "", value: "" })}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
