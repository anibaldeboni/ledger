import { useTranslation } from "react-i18next";
import { LedgerService } from "../../bindings/ledger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/page-header";
import { useAsync } from "../lib/hooks";
import { dt } from "../lib/format";
import ProductionFilamentEstimates from "./ProductionFilamentEstimates";

export default function ProductionArchive() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const archived = useAsync(() => LedgerService.ListArchivedProductionOrders(), []);
  const orders = archived.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("production.archive.title")}
        description={t("production.archive.description")}
      />
      {archived.error ? <p className="text-sm text-destructive" role="alert">{archived.error}</p> : null}
      {archived.loading && !archived.data ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground" role="status" aria-busy="true">
          {t("production.loading")}
        </div>
      ) : archived.data && orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
          {t("production.archive.empty")}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t("production.archive.orderCount", { count: orders.length })}
          </p>
          {orders.map((order) => {
            const tickets = order.tickets ?? [];
            return (
              <Card key={order.id}>
                <CardHeader>
                  <CardTitle className="break-words" role="heading" aria-level={2}>{order.title}</CardTitle>
                  <CardDescription>{t("production.orderId", { id: order.id })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="grid min-w-0 gap-1">
                      <dt className="text-xs font-medium text-muted-foreground">{t("production.archive.createdAt")}</dt>
                      <dd className="m-0 break-words text-sm tabular-nums">{dt(order.createdAt, locale)}</dd>
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <dt className="text-xs font-medium text-muted-foreground">{t("production.archive.completedAt")}</dt>
                      <dd className="m-0 break-words text-sm tabular-nums">{dt(order.completedAt, locale)}</dd>
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <dt className="text-xs font-medium text-muted-foreground">{t("production.archive.archivedAt")}</dt>
                      <dd className="m-0 break-words text-sm tabular-nums">{dt(order.archivedAt, locale)}</dd>
                    </div>
                    <div className="grid min-w-0 gap-1">
                      <dt className="text-xs font-medium text-muted-foreground">{t("production.archive.ticketCount")}</dt>
                      <dd className="m-0 text-sm tabular-nums">{tickets.length}</dd>
                    </div>
                  </dl>
                  <div className="grid gap-3">
                    <h3 className="text-sm font-semibold">{t("production.archive.tickets", { count: tickets.length })}</h3>
                    {tickets.length ? tickets.map((ticket) => (
                      <article className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" key={ticket.id}>
                        <div>
                          <h4 className="break-words text-sm font-semibold">{ticket.quoteName}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">{t("production.quoteId", { id: ticket.quoteId })}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("production.estimatedPrintHours", {
                              hours: ticket.estimatedPrintHours.toLocaleString(locale, { maximumFractionDigits: 2 }),
                            })}
                          </p>
                        </div>
                        <ProductionFilamentEstimates
                          filaments={ticket.filaments}
                          locale={locale}
                          label={t("production.estimatedFilaments")}
                          emptyLabel={t("production.noFilamentEstimate")}
                        />
                      </article>
                    )) : (
                      <p className="text-sm text-muted-foreground">{t("production.archive.noTickets")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
