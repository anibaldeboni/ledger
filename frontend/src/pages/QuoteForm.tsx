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
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { brl } from "../lib/format";
import { parseNum } from "../lib/format";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import { isValidPrintDuration } from "../lib/print-time";
import { marginPercentFromPrice } from "../lib/quote-pricing";
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
  const [adjustedPrice, setAdjustedPrice] = useState("");
  const [priceWasAdjusted, setPriceWasAdjusted] = useState(false);
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
    setAdjustedPrice(q.finalPrice > 0 ? String(q.finalPrice) : "");
    setPriceWasAdjusted(q.finalPrice > 0);
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
  const adjustedPriceNum = parseNum(adjustedPrice);
  const adjustedPriceValid =
    adjustedPriceNum !== null &&
    Number.isFinite(adjustedPriceNum) &&
    adjustedPriceNum > 0;
  const valid =
    printerId > 0 &&
    tariffId > 0 &&
    platesValid &&
    marginNum !== null &&
    Number.isFinite(marginNum) &&
    ((priceWasAdjusted || result)
      ? adjustedPriceValid
      : marginNum > 0 && marginNum < 100);

  function changeMargin(value: string) {
    setMargin(value);
    setPriceWasAdjusted(false);
    const nextMargin = parseNum(value);
    if (!result) {
      setAdjustedPrice("");
      return;
    }
    if (
      nextMargin === null ||
      !Number.isFinite(nextMargin) ||
      nextMargin >= 100
    ) {
      setAdjustedPrice("");
      return;
    }

    const nextPrice = result.totalCost / (1 - nextMargin / 100);
    setAdjustedPrice(
      nextPrice > 0 && Number.isFinite(nextPrice) ? String(nextPrice) : "",
    );
    if (nextPrice > 0 && Number.isFinite(nextPrice)) {
      setResult((current) =>
        current
          ? {
              ...current,
              finalPrice: nextPrice,
              profit: nextPrice - current.totalCost,
            }
          : current,
      );
    }
  }

  function changeAdjustedPrice(value: string) {
    setAdjustedPrice(value);
    if (value.trim() === "" && result) {
      setPriceWasAdjusted(false);
      setAdjustedPrice(result.finalPrice > 0 ? String(result.finalPrice) : "");
      const nextMargin = marginPercentFromPrice(
        result.totalCost,
        result.finalPrice,
      );
      if (nextMargin !== null) setMargin(String(nextMargin));
      return;
    }

    const price = parseNum(value);
    if (!result || price === null || !Number.isFinite(price) || price <= 0) {
      setPriceWasAdjusted(false);
      return;
    }

    const nextMargin = marginPercentFromPrice(result.totalCost, price);
    if (nextMargin !== null) {
      setPriceWasAdjusted(true);
      setMargin(String(nextMargin));
    }
  }

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
      finalPrice: priceWasAdjusted ? (adjustedPriceNum ?? 0) : 0,
      createdAt: "",
      updatedAt: "",
    };
  }

  async function calculate() {
    await runExclusive(async () => {
      clearError();
      try {
        const hasAdjustedPrice = priceWasAdjusted && adjustedPriceValid;
        const costs = await LedgerService.CalculateQuote(buildQuote());
        setResult(costs);
        if (hasAdjustedPrice && adjustedPriceNum !== null) {
          const nextMargin = marginPercentFromPrice(
            costs.totalCost,
            adjustedPriceNum,
          );
          if (nextMargin !== null) setMargin(String(nextMargin));
        } else {
          setAdjustedPrice(costs.finalPrice > 0 ? String(costs.finalPrice) : "");
          setPriceWasAdjusted(false);
        }
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
    <div className="space-y-5">
      <PageHeader
        title={quoteId ? t("quoteForm.title.edit") : t("quoteForm.title.new")}
        actions={
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label={t("common.back")}
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        }
      />

      {lists.error ? <p className="text-sm text-destructive" role="alert">{lists.error}</p> : null}
      {editing.error ? <p className="text-sm text-destructive" role="alert">{editing.error}</p> : null}
      {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("quoteForm.sections.printerAndEnergy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="quote-printer">{t("quoteForm.fields.printer")}</FieldLabel>
              <NativeSelect
                id="quote-printer"
                value={printerId}
                onChange={(e) => setPrinterId(Number(e.target.value))}
              >
                <option value={0}>{t("common.select")}</option>
                {printers.map((p: Printer) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.powerWatts} W
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-tariff">{t("quoteForm.fields.tariff")}</FieldLabel>
              <NativeSelect
                id="quote-tariff"
                value={tariffId}
                onChange={(e) => setTariffId(Number(e.target.value))}
              >
                <option value={0}>{t("common.select")}</option>
                {tariffs.map((t: Tariff) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {brl(t.kwhPrice, locale)}/kWh
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("quoteForm.sections.filaments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plates.map((p, i) => {
            const fil = filById.get(p.filamentId);
            const printTimeValid = isValidPrintDuration(p.time);
            const bad =
              p.filamentId === 0 ||
              (p.time !== "" && !printTimeValid) ||
              (p.weight !== "" && (parseNum(p.weight) ?? 0) <= 0);
            const invalidTime = bad && !printTimeValid;
            const invalidWeight = bad && (parseNum(p.weight) ?? 0) <= 0;
            return (
              <div
                className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end"
                key={i}
              >
                <Field data-invalid={p.filamentId === 0 || undefined}>
                  <FieldLabel className="sr-only" htmlFor={`quote-filament-${i}`}>
                    {t("quoteForm.options.chooseFilament")}
                  </FieldLabel>
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="size-4 shrink-0 rounded-full border border-border"
                      style={fil?.color ? { backgroundColor: fil.color } : undefined}
                      aria-hidden="true"
                    />
                    <NativeSelect
                      id={`quote-filament-${i}`}
                      value={p.filamentId}
                      aria-invalid={p.filamentId === 0}
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
                    </NativeSelect>
                  </div>
                </Field>
                <Field data-invalid={invalidTime || undefined}>
                  <FieldLabel htmlFor={`quote-duration-${i}`}>{t("quoteForm.fields.duration")}</FieldLabel>
                  <Input
                    id={`quote-duration-${i}`}
                    className="h-11"
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
                </Field>
                <Field data-invalid={invalidWeight || undefined}>
                  <FieldLabel htmlFor={`quote-weight-${i}`}>{t("quoteForm.fields.weight")}</FieldLabel>
                  <Input
                    id={`quote-weight-${i}`}
                    className="h-11"
                    inputMode="decimal"
                    aria-invalid={invalidWeight}
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
                </Field>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-lg"
                  className="size-11 justify-self-end"
                  aria-label={t("quoteForm.removeFilament")}
                  title={t("quoteForm.removeFilament")}
                  onClick={() => setPlates((ps) => ps.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-11"
              aria-label={t("quoteForm.addFilament")}
              title={t("quoteForm.addFilament")}
              onClick={() => setPlates((ps) => [...ps, { ...emptyPlate }])}
            >
              <Plus aria-hidden="true" />
            </Button>
            {plates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("quoteForm.needFilament")}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("quoteForm.sections.fixedCosts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fixed.map((f, i) => (
            <div
              className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
              key={i}
            >
              <Field>
                <FieldLabel className="sr-only" htmlFor={`quote-category-${i}`}>
                  {t("quoteForm.options.chooseCategory")}
                </FieldLabel>
                <NativeSelect
                  id={`quote-category-${i}`}
                  value={f.categoryId}
                  onChange={(e) => pickCategory(i, Number(e.target.value))}
                >
                  <option value={0}>{t("quoteForm.options.chooseCategory")}</option>
                  {categories.map((c: CostCategory) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`quote-fixed-cost-${i}`}>{t("quoteForm.fields.fixedCost")}</FieldLabel>
                <Input
                  id={`quote-fixed-cost-${i}`}
                  className="h-11"
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
              </Field>
              <Button
                type="button"
                variant="destructive"
                size="icon-lg"
                className="size-11 justify-self-end"
                aria-label={t("quoteForm.removeCost")}
                title={t("quoteForm.removeCost")}
                onClick={() => setFixed((fs) => fs.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            title={t("quoteForm.addCost")}
            aria-label={t("quoteForm.addCost")}
            onClick={() => setFixed((fs) => [...fs, { categoryId: 0, value: "" }])}
          >
            <Plus aria-hidden="true" />
          </Button>
          <FieldGroup className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor="quote-new-category">{t("quoteForm.fields.newCategory")}</FieldLabel>
              <Input
                id="quote-new-category"
                className="h-11"
                value={newCat.name}
                placeholder={t("quoteForm.placeholders.newCategory")}
                onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-new-category-value">{t("quoteForm.fields.defaultValue")}</FieldLabel>
              <Input
                id="quote-new-category-value"
                className="h-11"
                inputMode="decimal"
                value={newCat.value}
                placeholder="0"
                onChange={(e) => setNewCat((c) => ({ ...c, value: e.target.value }))}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={createCategory}
              disabled={!newCat.name.trim() || busy}
            >
              {t("quoteForm.createAndAddCategory")}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("quoteForm.sections.profitMargin")}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-end">
            <Field>
              <FieldLabel htmlFor="quote-margin">{t("quoteForm.fields.margin")}</FieldLabel>
              <Input
                id="quote-margin"
                className="h-11"
                inputMode="decimal"
                value={margin}
                placeholder={t("quoteForm.placeholders.margin")}
                onChange={(e) => changeMargin(e.target.value)}
              />
            </Field>
            <p className="pb-2 text-sm text-muted-foreground">{t("quoteForm.finalPriceFormula")}</p>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="cta"
          size="lg"
          className="min-h-11"
          disabled={!valid || busy}
          onClick={calculate}
        >
          {t("quoteForm.calculate")}
        </Button>
        {!valid ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("quoteForm.requiredFields")}
          </p>
        ) : null}
      </div>

      {result ? (
        <Card className="border-primary/20">
          <CardContent className="space-y-3">
            <dl className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.filament")}</dt>
                <dd className="m-0 tabular-nums">{brl(result.filament, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.energy")}</dt>
                <dd className="m-0 tabular-nums">{brl(result.energy, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.amortization")}</dt>
                <dd className="m-0 tabular-nums">{brl(result.amortization, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.fixedCosts")}</dt>
                <dd className="m-0 tabular-nums">{brl(result.fixedCosts, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.totalCost")}</dt>
                <dd className="m-0 tabular-nums">{brl(result.totalCost, locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{t("quoteForm.result.profit")}</dt>
                <dd className="m-0 tabular-nums">
                  {brl(
                    adjustedPriceValid && adjustedPriceNum !== null
                      ? adjustedPriceNum - result.totalCost
                      : result.profit,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <span className="text-sm font-medium">{t("quoteForm.result.finalPrice")}</span>
              <span className="text-2xl font-semibold tabular-nums text-cta">
                {brl(result.finalPrice, locale)}
              </span>
            </div>
            <FieldGroup className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-[15rem_minmax(0,1fr)_auto] xl:items-end">
              <Field data-invalid={!adjustedPriceValid || undefined}>
                <FieldLabel htmlFor="quote-adjusted-price">{t("quoteForm.fields.adjustedPrice")}</FieldLabel>
                <Input
                  id="quote-adjusted-price"
                  className="h-11"
                  inputMode="decimal"
                  value={adjustedPrice}
                  aria-invalid={!adjustedPriceValid}
                  onChange={(e) => changeAdjustedPrice(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="quote-name">{t("quoteForm.fields.quoteName")}</FieldLabel>
                <Input
                  id="quote-name"
                  className="h-11"
                  value={name}
                  placeholder={t("quoteForm.placeholders.quoteName")}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Button
                type="button"
                variant="default"
                size="lg"
                className="min-h-11"
                disabled={!canSave || busy}
                onClick={save}
              >
                {quoteId ? t("quoteForm.saveChanges") : t("quoteForm.saveQuote")}
              </Button>
            </FieldGroup>
            {!canSave ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t("quoteForm.needName")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
