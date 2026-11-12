import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const label = armed
    ? t("common.confirmDeleteItem", { item })
    : t("common.deleteItem", { item });
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
  const { t } = useTranslation();
  const [filamentsRefreshKey, setFilamentsRefreshKey] = useState(0);
  return (
    <div>
      <div className="page-head">
        <h1>{t("settings.title")}</h1>
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
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
      <h2>{t("settings.printers.title")}</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">{t("settings.printers.empty")}</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-printer">
            <span>{t("settings.printers.table.name")}</span>
            <span className="money">{t("settings.printers.table.purchase")}</span>
            <span className="money">{t("settings.printers.table.resale")}</span>
            <span className="money">{t("settings.printers.table.lifespan")}</span>
            <span className="money">{t("settings.printers.table.power")}</span>
            <span />
          </div>
          {(list.data ?? []).map((p) => (
            <div className="list-row cols-printer" key={p.id}>
              <span>{p.name}</span>
              <span className="money">{brl(p.purchasePrice, locale)}</span>
              <span className="money">{brl(p.resalePrice, locale)}</span>
              <span className="money">
                {p.lifespanHours.toLocaleString(locale)}
              </span>
              <span className="money">
                {p.powerWatts.toLocaleString(locale)}
              </span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("common.editItem", { item: t("settings.items.printer", { name: p.name }) })}
                  title={t("common.editItem", { item: t("settings.items.printer", { name: p.name }) })}
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
                  item={t("settings.items.printer", { name: p.name })}
                  onConfirm={() => remove(p.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          {t("settings.printers.fields.name")}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("settings.printers.namePlaceholder")}
          />
        </label>
        <label className="field">
          {t("settings.printers.fields.purchase")}
          <input
            inputMode="decimal"
            value={form.purchase}
            onChange={(e) => setForm({ ...form, purchase: e.target.value })}
            placeholder="4500"
          />
        </label>
        <label className="field">
          {t("settings.printers.fields.resale")}
          <input
            inputMode="decimal"
            value={form.resale}
            onChange={(e) => setForm({ ...form, resale: e.target.value })}
            placeholder="500"
          />
        </label>
        <label className="field">
          {t("settings.printers.fields.lifespan")}
          <input
            inputMode="decimal"
            value={form.lifespan}
            onChange={(e) => setForm({ ...form, lifespan: e.target.value })}
            placeholder="5000"
          />
        </label>
        <label className="field">
          {t("settings.printers.fields.power")}
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
            {busy ? t("common.saving") : editing ? t("common.save") : t("common.add")}
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
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Bandeiras tarifárias (S2) -------------------------------------------------

function TariffsSection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
      <h2>{t("settings.tariffs.title")}</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">{t("settings.tariffs.empty")}</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-tariff">
            <span>{t("settings.tariffs.name")}</span>
            <span className="money">{t("settings.tariffs.kwh")}</span>
            <span />
          </div>
          {(list.data ?? []).map((tariff) => (
            <div className="list-row cols-tariff" key={tariff.id}>
              <span>{tariff.name}</span>
              <span className="money">{brl(tariff.kwhPrice, locale)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("common.editItem", { item: t("settings.items.tariff", { name: tariff.name }) })}
                  title={t("common.editItem", { item: t("settings.items.tariff", { name: tariff.name }) })}
                  onClick={() =>
                    setForm({ id: tariff.id, name: tariff.name, kwh: String(tariff.kwhPrice) })
                  }
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <DeleteButton
                  item={t("settings.items.tariff", { name: tariff.name })}
                  onConfirm={() => remove(tariff.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          {t("settings.tariffs.name")}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("settings.tariffs.namePlaceholder")}
          />
        </label>
        <label className="field">
          {t("settings.tariffs.pricePerKwh")}
          <input
            inputMode="decimal"
            value={form.kwh}
            onChange={(e) => setForm({ ...form, kwh: e.target.value })}
            placeholder={t("settings.tariffs.pricePlaceholder")}
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!form.name.trim() || busy}
            onClick={save}
          >
            {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
          </button>
          {form.id ? (
            <button
              className="btn"
              onClick={() => setForm({ id: 0, name: "", kwh: "" })}
            >
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Filamentos (S3) -----------------------------------------------------------

function FilamentsSection({ refreshKey }: { refreshKey: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
      <h2>{t("settings.filaments.title")}</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">{t("settings.filaments.empty")}</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-fil">
            <span />
            <span>{t("settings.filaments.name")}</span>
            <span>{t("settings.filaments.material")}</span>
            <span className="money">{t("settings.filaments.pricePerKg")}</span>
            <span>{t("settings.filaments.source")}</span>
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
              <span className="money">{brl(f.pricePerKg, locale)}</span>
              <span className="muted">
                {f.source === "spoolman" ? "Spoolman" : t("settings.filaments.manual")}
              </span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("common.editItem", { item: t("settings.items.filament", { name: f.name }) })}
                  title={t("common.editItem", { item: t("settings.items.filament", { name: f.name }) })}
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
                  item={t("settings.items.filament", { name: f.name })}
                  onConfirm={() => remove(f.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          {t("settings.filaments.name")}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("settings.filaments.namePlaceholder")}
          />
        </label>
        <label className="field">
          {t("settings.filaments.material")}
          <input
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            placeholder={t("settings.filaments.materialPlaceholder")}
          />
        </label>
        <label className="field" style={{ flexBasis: 90 }}>
          {t("settings.filaments.color")}
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            style={{ padding: 3, height: 35 }}
          />
        </label>
        <label className="field">
          {t("settings.filaments.price")}
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
            {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
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
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Spoolman (S3, S4) ---------------------------------------------------------

function SpoolmanSection({ onImported }: { onImported: () => void }) {
  const { t } = useTranslation();
  const config = useAsync(() => LedgerService.GetSpoolmanURL(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr, clearErr] = useActionError();
  const [status, setStatus] = useState<{ key: string; count?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const value = url ?? config.data ?? "";

  async function persist() {
    clearErr();
    setStatus(null);
    try {
      await LedgerService.SetSpoolmanURL(value.trim());
      setUrl(value.trim());
      setStatus({ key: "settings.spoolman.urlSaved" });
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
      setStatus({ key: "settings.spoolman.connectionOk" });
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
      setStatus({ key: "settings.spoolman.imported", count: n });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="block">
      <h2>{t("settings.spoolman.title")}</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {status ? <p className="ok-text">{t(status.key, { count: status.count })}</p> : null}
      <div className="row">
        <label className="field grow">
          {t("settings.spoolman.url")}
          <input
            value={value}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("settings.spoolman.urlPlaceholder")}
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button
            className="btn btn-icon"
            title={t("settings.spoolman.save")}
            aria-label={t("settings.spoolman.save")}
            onClick={persist}
          >
            <Save size={22} aria-hidden="true" />
          </button>
          <button
            className="btn btn-icon"
            title={t("settings.spoolman.testConnection")}
            aria-label={t("settings.spoolman.testConnection")}
            disabled={busy || !value.trim()}
            onClick={test}
          >
            <PhoneOutgoing size={22} aria-hidden="true" />
          </button>
          <button
            className="btn btn-primary btn-icon"
            title={t("settings.spoolman.import")}
            aria-label={t("settings.spoolman.import")}
            disabled={busy || !value.trim()}
            onClick={importSpools}
          >
            <CloudSync size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="hint">{t("settings.spoolman.hint")}</p>
    </section>
  );
}

// --- Categorias de custo fixo (S5) ---------------------------------------------

function CostCategoriesSection() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
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
      <h2>{t("settings.categories.title")}</h2>
      {err ? <p className="error-text">{err}</p> : null}
      {(list.data ?? []).length === 0 ? (
        <p className="hint">{t("settings.categories.empty")}</p>
      ) : (
        <div className="list" style={{ marginBottom: 14 }}>
          <div className="row-head cols-cat">
            <span>{t("settings.categories.name")}</span>
            <span className="money">{t("settings.categories.defaultValue")}</span>
            <span />
          </div>
          {(list.data ?? []).map((c) => (
            <div className="list-row cols-cat" key={c.id}>
              <span>{c.name}</span>
              <span className="money">{brl(c.defaultValue, locale)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("common.editItem", { item: t("settings.items.category", { name: c.name }) })}
                  title={t("common.editItem", { item: t("settings.items.category", { name: c.name }) })}
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
                  item={t("settings.items.category", { name: c.name })}
                  onConfirm={() => remove(c.id)}
                />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <label className="field">
          {t("settings.categories.name")}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("settings.categories.namePlaceholder")}
          />
        </label>
        <label className="field">
          {t("settings.categories.value")}
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
            {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
          </button>
          {form.id ? (
            <button
              className="btn"
              onClick={() => setForm({ id: 0, name: "", value: "" })}
            >
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
