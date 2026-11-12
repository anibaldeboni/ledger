import { useTranslation } from "react-i18next";
import { LedgerService } from "../../bindings/ledger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAsync } from "../lib/hooks";
import { dt } from "../lib/format";
import ProductionFilamentEstimates from "./ProductionFilamentEstimates";

export default function ProductionArchive() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const archived = useAsync(() => LedgerService.ListArchivedProductionOrders(), []);
  const orders = archived.data ?? [];

  return (
    <div className="production-page production-archive-page">
      <header className="page-head">
        <div>
          <h1>{t("production.archive.title")}</h1>
          <p className="hint">{t("production.archive.description")}</p>
        </div>
      </header>
      {archived.error ? <p className="error-text" role="alert">{archived.error}</p> : null}
      {archived.loading && !archived.data ? (
        <div className="empty" role="status" aria-busy="true">{t("production.loading")}</div>
      ) : archived.data && orders.length === 0 ? (
        <div className="empty" role="status">{t("production.archive.empty")}</div>
      ) : (
        <div className="production-archive-list">
          <p className="hint" role="status" aria-live="polite">
            {t("production.archive.orderCount", { count: orders.length })}
          </p>
          {orders.map((order) => {
            const tickets = order.tickets ?? [];
            return (
              <Card key={order.id} className="production-archive-order">
                <CardHeader>
                  <CardTitle role="heading" aria-level={2}>{order.title}</CardTitle>
                  <CardDescription>{t("production.orderId", { id: order.id })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="production-report-metrics">
                    <div>
                      <dt>{t("production.archive.createdAt")}</dt>
                      <dd>{dt(order.createdAt, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("production.archive.completedAt")}</dt>
                      <dd>{dt(order.completedAt, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("production.archive.archivedAt")}</dt>
                      <dd>{dt(order.archivedAt, locale)}</dd>
                    </div>
                    <div>
                      <dt>{t("production.archive.ticketCount")}</dt>
                      <dd>{tickets.length}</dd>
                    </div>
                  </dl>
                  <div className="production-archive-tickets">
                    <h3>{t("production.archive.tickets", { count: tickets.length })}</h3>
                    {tickets.length ? tickets.map((ticket) => (
                      <article className="production-archive-ticket" key={ticket.id}>
                        <div>
                          <h4>{ticket.quoteName}</h4>
                          <p className="production-order-meta">{t("production.quoteId", { id: ticket.quoteId })}</p>
                          <p className="production-order-meta">
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
                      <p className="hint">{t("production.archive.noTickets")}</p>
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
