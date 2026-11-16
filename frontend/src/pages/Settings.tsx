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
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
    <Button
      type="button"
      variant="destructive"
      size="icon-lg"
      className="size-11"
      aria-label={label}
      title={label}
      onClick={() => {
        if (armed) onConfirm();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? (
        <Check aria-hidden="true" />
      ) : (
        <Trash2 aria-hidden="true" />
      )}
    </Button>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const [filamentsRefreshKey, setFilamentsRefreshKey] = useState(0);
  return (
    <div className="space-y-5">
      <PageHeader title={t("settings.title")} />
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.printers.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">{t("settings.printers.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("settings.printers.table.name")}</TableHead>
                  <TableHead className="text-right">{t("settings.printers.table.purchase")}</TableHead>
                  <TableHead className="text-right">{t("settings.printers.table.resale")}</TableHead>
                  <TableHead className="text-right">{t("settings.printers.table.lifespan")}</TableHead>
                  <TableHead className="text-right">{t("settings.printers.table.power")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.purchasePrice, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.resalePrice, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.lifespanHours.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.powerWatts.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="size-11"
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
                          <Pencil aria-hidden="true" />
                        </Button>
                        <DeleteButton
                          item={t("settings.items.printer", { name: p.name })}
                          onConfirm={() => remove(p.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end">
          <Field>
            <FieldLabel htmlFor="settings-printer-name">{t("settings.printers.fields.name")}</FieldLabel>
            <Input
              id="settings-printer-name"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("settings.printers.namePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-printer-purchase">{t("settings.printers.fields.purchase")}</FieldLabel>
            <Input
              id="settings-printer-purchase"
              className="h-11"
              inputMode="decimal"
              value={form.purchase}
              onChange={(e) => setForm({ ...form, purchase: e.target.value })}
              placeholder="4500"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-printer-resale">{t("settings.printers.fields.resale")}</FieldLabel>
            <Input
              id="settings-printer-resale"
              className="h-11"
              inputMode="decimal"
              value={form.resale}
              onChange={(e) => setForm({ ...form, resale: e.target.value })}
              placeholder="500"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-printer-lifespan">{t("settings.printers.fields.lifespan")}</FieldLabel>
            <Input
              id="settings-printer-lifespan"
              className="h-11"
              inputMode="decimal"
              value={form.lifespan}
              onChange={(e) => setForm({ ...form, lifespan: e.target.value })}
              placeholder="5000"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-printer-power">{t("settings.printers.fields.power")}</FieldLabel>
            <Input
              id="settings-printer-power"
              className="h-11"
              inputMode="decimal"
              value={form.watts}
              onChange={(e) => setForm({ ...form, watts: e.target.value })}
              placeholder="250"
            />
          </Field>
          <div className="flex items-center gap-2 xl:pt-6">
            <Button type="button" variant="default" size="lg" className="min-h-11" disabled={!form.name.trim() || busy} onClick={save}>
              {busy ? t("common.saving") : editing ? t("common.save") : t("common.add")}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11"
                onClick={() => setForm({ id: 0, name: "", purchase: "", resale: "", lifespan: "", watts: "" })}
              >
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tariffs.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">{t("settings.tariffs.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table className="min-w-[28rem]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("settings.tariffs.name")}</TableHead>
                  <TableHead className="text-right">{t("settings.tariffs.kwh")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map((tariff) => (
                  <TableRow key={tariff.id}>
                    <TableCell className="font-medium">{tariff.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(tariff.kwhPrice, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="size-11"
                          aria-label={t("common.editItem", { item: t("settings.items.tariff", { name: tariff.name }) })}
                          title={t("common.editItem", { item: t("settings.items.tariff", { name: tariff.name }) })}
                          onClick={() => setForm({ id: tariff.id, name: tariff.name, kwh: String(tariff.kwhPrice) })}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <DeleteButton
                          item={t("settings.items.tariff", { name: tariff.name })}
                          onConfirm={() => remove(tariff.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="settings-tariff-name">{t("settings.tariffs.name")}</FieldLabel>
            <Input
              id="settings-tariff-name"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("settings.tariffs.namePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-tariff-kwh">{t("settings.tariffs.pricePerKwh")}</FieldLabel>
            <Input
              id="settings-tariff-kwh"
              className="h-11"
              inputMode="decimal"
              value={form.kwh}
              onChange={(e) => setForm({ ...form, kwh: e.target.value })}
              placeholder={t("settings.tariffs.pricePlaceholder")}
            />
          </Field>
          <div className="flex items-center gap-2 sm:pt-6">
            <Button type="button" variant="default" size="lg" className="min-h-11" disabled={!form.name.trim() || busy} onClick={save}>
              {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
            </Button>
            {form.id ? (
              <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => setForm({ id: 0, name: "", kwh: "" })}>
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.filaments.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">{t("settings.filaments.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10" />
                  <TableHead>{t("settings.filaments.name")}</TableHead>
                  <TableHead>{t("settings.filaments.material")}</TableHead>
                  <TableHead className="text-right">{t("settings.filaments.pricePerKg")}</TableHead>
                  <TableHead>{t("settings.filaments.source")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <span
                        className="block size-4 rounded-full border border-border"
                        style={{ backgroundColor: f.color || undefined }}
                        aria-hidden="true"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-muted-foreground">{f.material || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(f.pricePerKg, locale)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.source === "spoolman" ? "Spoolman" : t("settings.filaments.manual")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="size-11"
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
                          <Pencil aria-hidden="true" />
                        </Button>
                        <DeleteButton
                          item={t("settings.items.filament", { name: f.name })}
                          onConfirm={() => remove(f.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_6rem_minmax(0,1fr)_auto] xl:items-end">
          <Field>
            <FieldLabel htmlFor="settings-filament-name">{t("settings.filaments.name")}</FieldLabel>
            <Input
              id="settings-filament-name"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("settings.filaments.namePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-filament-material">{t("settings.filaments.material")}</FieldLabel>
            <Input
              id="settings-filament-material"
              className="h-11"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              placeholder={t("settings.filaments.materialPlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-filament-color">{t("settings.filaments.color")}</FieldLabel>
            <Input
              id="settings-filament-color"
              className="h-11 w-full cursor-pointer p-1"
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-filament-price">{t("settings.filaments.price")}</FieldLabel>
            <Input
              id="settings-filament-price"
              className="h-11"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="99"
            />
          </Field>
          <div className="flex items-center gap-2 xl:pt-6">
            <Button type="button" variant="default" size="lg" className="min-h-11" disabled={!form.name.trim() || busy} onClick={save}>
              {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11"
                onClick={() => setForm({ id: 0, name: "", material: "", color: "#8b93a9", price: "" })}
              >
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.spoolman.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
        {status ? (
          <p className="text-sm text-success" role="status">
            {t(status.key, { count: status.count })}
          </p>
        ) : null}
        <FieldGroup className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <Field>
            <FieldLabel htmlFor="settings-spoolman-url">{t("settings.spoolman.url")}</FieldLabel>
            <Input
              id="settings-spoolman-url"
              className="h-11"
              value={value}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("settings.spoolman.urlPlaceholder")}
              spellCheck={false}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-11"
              title={t("settings.spoolman.save")}
              aria-label={t("settings.spoolman.save")}
              onClick={persist}
            >
              <Save aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-11"
              title={t("settings.spoolman.testConnection")}
              aria-label={t("settings.spoolman.testConnection")}
              disabled={busy || !value.trim()}
              onClick={test}
            >
              <PhoneOutgoing aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="cta"
              size="icon-lg"
              className="size-11"
              title={t("settings.spoolman.import")}
              aria-label={t("settings.spoolman.import")}
              disabled={busy || !value.trim()}
              onClick={importSpools}
            >
              <CloudSync aria-hidden="true" />
            </Button>
          </div>
        </FieldGroup>
        <p className="text-sm text-muted-foreground">{t("settings.spoolman.hint")}</p>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.categories.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive" role="alert">{err}</p> : null}
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">{t("settings.categories.empty")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table className="min-w-[28rem]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t("settings.categories.name")}</TableHead>
                  <TableHead className="text-right">{t("settings.categories.defaultValue")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(c.defaultValue, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="size-11"
                          aria-label={t("common.editItem", { item: t("settings.items.category", { name: c.name }) })}
                          title={t("common.editItem", { item: t("settings.items.category", { name: c.name }) })}
                          onClick={() => setForm({ id: c.id, name: c.name, value: String(c.defaultValue) })}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                        <DeleteButton
                          item={t("settings.items.category", { name: c.name })}
                          onConfirm={() => remove(c.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <FieldGroup className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="settings-category-name">{t("settings.categories.name")}</FieldLabel>
            <Input
              id="settings-category-name"
              className="h-11"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("settings.categories.namePlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-category-value">{t("settings.categories.value")}</FieldLabel>
            <Input
              id="settings-category-value"
              className="h-11"
              inputMode="decimal"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="0"
            />
          </Field>
          <div className="flex items-center gap-2 sm:pt-6">
            <Button type="button" variant="default" size="lg" className="min-h-11" disabled={!form.name.trim() || busy} onClick={save}>
              {busy ? t("common.saving") : form.id ? t("common.save") : t("common.add")}
            </Button>
            {form.id ? (
              <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => setForm({ id: 0, name: "", value: "" })}>
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
