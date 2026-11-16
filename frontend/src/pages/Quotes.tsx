import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  BetweenHorizontalStart,
  Check,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { LedgerService } from "../../bindings/ledger";
import type {
  ProductionOrder,
  QuoteSummary,
} from "../../bindings/ledger/internal/domain/models";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { brl, dt } from "../lib/format";
import { useActionError, useAsync, useSubmission } from "../lib/hooks";
import {
  filterByName,
  filterQuotesByName,
  sortQuotes,
  type QuoteSort,
} from "../lib/search";

function SortButton(props: {
  label: string;
  active: boolean;
  dir: QuoteSort["dir"];
  align?: "left" | "right";
  onClick: () => void;
}) {
  const { label, active, dir, align = "left", onClick } = props;
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className={`min-h-11 min-w-0 gap-1 px-0 text-left text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground ${align === "right" ? "justify-end" : "justify-start"}`}
      onClick={onClick}
      aria-label={
        active
          ? t("quotes.sort.active", {
              label,
              direction: t(
                dir === "asc"
                  ? "quotes.sort.ascending"
                  : "quotes.sort.descending",
              ),
            })
          : t("quotes.sort.by", { label })
      }
    >
      {label}
      {active &&
        (dir === "asc" ? (
          <ArrowUp aria-hidden="true" />
        ) : (
          <ArrowDown aria-hidden="true" />
        ))}
    </Button>
  );
}

export default function Quotes({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (id: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const quotes = useAsync(() => LedgerService.ListQuotes(), []);
  const productionOrders = useAsync(
    () => LedgerService.ListProductionOrders(),
    [],
  );
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QuoteSort>({ key: "updated", dir: "desc" });
  const [actionError, setActionError, clearActionError] = useActionError();

  function toggleSort(key: QuoteSort["key"]) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  async function remove(id: number) {
    clearActionError();
    try {
      await LedgerService.DeleteQuote(id);
      setConfirmId(null);
      quotes.reload();
    } catch (e) {
      setActionError(e);
    }
  }

  const list = quotes.data ?? [];
  const filtered = filterQuotesByName(list, search);
  const rows = sortQuotes(filtered, sort);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("quotes.title")}
        actions={
          <>
            <Input
            type="search"
            className="h-11 w-full sm:w-64"
            placeholder={t("quotes.searchPlaceholder")}
            aria-label={t("quotes.searchLabel")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
            <Button
              type="button"
              variant="cta"
              size="icon-lg"
              className="size-11 shrink-0"
            aria-label={t("quotes.create")}
            title={t("quotes.create")}
            onClick={onNew}
          >
              <Plus aria-hidden="true" />
            </Button>
          </>
        }
      />

      {quotes.error ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {quotes.error}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-muted-foreground">
          {t("quotes.empty")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-muted-foreground">
          {t("quotes.noResults", { term: search.trim() })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="min-w-[46rem]">
            <TableCaption className="sr-only">{t("quotes.title")}</TableCaption>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[40%]">
              <SortButton
                label={t("quotes.table.name")}
                active={sort.key === "name"}
                dir={sort.dir}
                onClick={() => toggleSort("name")}
              />
                </TableHead>
                <TableHead className="w-28 text-right">{t("quotes.table.margin")}</TableHead>
                <TableHead className="w-36 text-right">{t("quotes.table.finalPrice")}</TableHead>
                <TableHead className="w-40">
              <SortButton
                label={t("quotes.table.updated")}
                active={sort.key === "updated"}
                dir={sort.dir}
                align="right"
                onClick={() => toggleSort("updated")}
              />
                </TableHead>
                <TableHead className="w-32 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-0 truncate font-medium">{q.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {q.marginPercent.toLocaleString(locale)}%
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-cta">
                    {brl(q.finalPrice, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {dt(q.updatedAt, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        className="size-11"
                        aria-label={t("common.editItem", {
                          item: t("quotes.item", { name: q.name }),
                        })}
                        title={t("common.editItem", {
                          item: t("quotes.item", { name: q.name }),
                        })}
                        onClick={() => onEdit(q.id)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <QuoteOrderPopover
                        quote={q}
                        orders={productionOrders.data ?? []}
                        ordersLoading={productionOrders.loading}
                        ordersError={productionOrders.error}
                        onRefreshOrders={productionOrders.reload}
                      />
                      {confirmId === q.id ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-lg"
                          className="size-11"
                          aria-label={t("common.confirmDeleteItem", {
                            item: t("quotes.item", { name: q.name }),
                          })}
                          title={t("common.confirmDeleteItem", {
                            item: t("quotes.item", { name: q.name }),
                          })}
                          onClick={() => remove(q.id)}
                        >
                          <Check aria-hidden="true" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-lg"
                          className="size-11"
                          aria-label={t("common.deleteItem", {
                            item: t("quotes.item", { name: q.name }),
                          })}
                          title={t("common.deleteItem", {
                            item: t("quotes.item", { name: q.name }),
                          })}
                          onClick={() => setConfirmId(q.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function QuoteOrderPopover({
  quote,
  orders,
  ordersLoading,
  ordersError,
  onRefreshOrders,
}: {
  quote: QuoteSummary;
  orders: ProductionOrder[];
  ordersLoading: boolean;
  ordersError: string | null;
  onRefreshOrders: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [newOrderName, setNewOrderName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError, clearActionError] = useActionError();
  const { busy, run: runExclusive } = useSubmission();
  const openOrders = orders.filter(
    (order) => !order.completedAt && !order.archivedAt,
  );
  const filteredOrders = filterByName(
    openOrders,
    search,
    (order) => order.title,
  );

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setSearch("");
    setSelectedOrderIds([]);
    setNewOrderName("");
    setStatus(null);
    clearActionError();
    if (!ordersLoading) onRefreshOrders();
  }

  async function addToSelectedOrders() {
    const orderIds = [...selectedOrderIds];
    if (orderIds.length === 0) return;
    clearActionError();
    setStatus(t("quotes.addingToOrders"));

    const result = await runExclusive(async () => {
      let added = 0;
      const failed: unknown[] = [];
      for (const orderId of orderIds) {
        try {
          await LedgerService.AddProductionTicket(orderId, quote.id);
          added += 1;
        } catch (error) {
          failed.push(error);
        }
      }
      return { added, failed };
    });
    if (!result) {
      setStatus(null);
      return;
    }

    setSelectedOrderIds([]);
    onRefreshOrders();
    if (result.failed.length > 0) {
      setActionError(result.failed[0]);
      if (result.added > 0) {
        setStatus(
          t("quotes.partiallyAddedOrders", {
            added: result.added,
            failed: result.failed.length,
          }),
        );
      } else {
        setStatus(null);
      }
      return;
    }
    setStatus(
      t(
        result.added === 1
          ? "quotes.addedToOneOrder"
          : "quotes.addedToManyOrders",
        { count: result.added },
      ),
    );
  }

  async function createOrderAndAddQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newOrderName.trim();
    if (!title) return;
    clearActionError();
    setStatus(t("quotes.creatingOrder"));

    try {
      const result = await runExclusive(async () => {
        const order = await LedgerService.CreateProductionOrder(title);
        try {
          await LedgerService.AddProductionTicket(order.id, quote.id);
          return { order };
        } catch (error) {
          return { order, error };
        }
      });
      if (!result) {
        setStatus(null);
        return;
      }
      setNewOrderName("");
      onRefreshOrders();
      if ("error" in result) {
        setStatus(
          t("quotes.createdOrderButAddFailed", { name: result.order.title }),
        );
        setActionError(result.error);
        return;
      }
      setStatus(t("quotes.createdOrderAndAdded", { name: result.order.title }));
    } catch (error) {
      setStatus(null);
      setActionError(error);
    }
  }

  function toggleOrder(orderId: number, checked: boolean) {
    clearActionError();
    setStatus(null);
    setSelectedOrderIds((current) => {
      if (!checked) return current.filter((id) => id !== orderId);
      return current.includes(orderId) ? current : [...current, orderId];
    });
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <Button asChild variant="outline" size="icon-lg" className="size-11">
        <PopoverPrimitive.Trigger
          type="button"
          aria-label={t("quotes.addToOrder", { quote: quote.name })}
          title={t("quotes.addToOrder", { quote: quote.name })}
          disabled={busy}
        >
          <Send aria-hidden="true" />
        </PopoverPrimitive.Trigger>
      </Button>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 flex max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
          side="bottom"
          align="end"
          sideOffset={6}
        >
          <FieldGroup className="gap-3">
            <Field>
              <Input
                id={`quote-order-search-${quote.id}`}
                name={`quote-order-search-${quote.id}`}
                type="search"
                autoComplete="off"
                placeholder={t("quotes.orderSearchPlaceholder")}
                value={search}
                disabled={busy || ordersLoading}
                className="h-11"
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <Separator />
          <FieldSet className="gap-2">
            <FieldLegend variant="label">{t("quotes.openOrders")}</FieldLegend>
            {ordersLoading ? (
              <p
                className="text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {t("quotes.loadingOrders")}
              </p>
            ) : ordersError ? (
              <p className="text-sm text-destructive" role="alert">
                {ordersError}
              </p>
            ) : openOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("quotes.noOpenOrders")}
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("quotes.noMatchingOrders")}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto pr-1">
                <FieldGroup className="gap-1">
                  {filteredOrders.map((order) => {
                    const checkboxId = `quote-${quote.id}-order-${order.id}`;
                    return (
                      <Field
                        key={order.id}
                        orientation="horizontal"
                        data-disabled={busy || ordersLoading || undefined}
                        className="min-h-11 rounded-md px-2 hover:bg-accent/50"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={selectedOrderIds.includes(order.id)}
                          disabled={busy || ordersLoading}
                          onCheckedChange={(checked) =>
                            toggleOrder(order.id, checked === true)
                          }
                        />
                        <FieldLabel
                          htmlFor={checkboxId}
                          className="min-h-11 min-w-0 flex-1 cursor-pointer items-center break-words"
                        >
                          {order.title}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </FieldGroup>
              </div>
            )}
          </FieldSet>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full"
            disabled={busy || ordersLoading || selectedOrderIds.length === 0}
            onClick={addToSelectedOrders}
          >
            {selectedOrderIds.length === 0
              ? t("quotes.selectOrdersToAdd")
              : selectedOrderIds.length === 1
                ? t("quotes.addSelectedOrder")
                : t("quotes.addSelectedOrders", {
                    count: selectedOrderIds.length,
                  })}
          </Button>
          <Separator />
          <form onSubmit={createOrderAndAddQuote}>
            <FieldGroup className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <Field>
                <FieldLabel htmlFor={`quote-new-order-${quote.id}`}>
                  {t("quotes.createOrderLabel")}
                </FieldLabel>
                <Input
                  id={`quote-new-order-${quote.id}`}
                  name={`quote-new-order-${quote.id}`}
                  autoComplete="off"
                  value={newOrderName}
                  placeholder={t("quotes.createOrderPlaceholder")}
                  disabled={busy}
                  required
                  className="h-11"
                  onChange={(event) => {
                    setNewOrderName(event.target.value);
                    setStatus(null);
                    clearActionError();
                  }}
                />
              </Field>
              <Button
                type="submit"
                variant="default"
                size="icon"
                className="size-11 shrink-0"
                aria-label={t("quotes.createOrderAndAddTooltip")}
                title={t("quotes.createOrderAndAddTooltip")}
                disabled={busy || !newOrderName.trim()}
              >
                <BetweenHorizontalStart aria-hidden="true" />
              </Button>
            </FieldGroup>
          </form>
          {status ? (
            <p
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          ) : null}
          {actionError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
