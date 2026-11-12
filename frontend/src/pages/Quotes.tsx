import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import { brl, dt } from "../lib/format";
import { useActionError, useAsync } from "../lib/hooks";
import { filterQuotesByName, sortQuotes, type QuoteSort } from "../lib/search";

function SortButton(props: { label: string; active: boolean; dir: QuoteSort["dir"]; onClick: () => void }) {
  const { label, active, dir, onClick } = props;
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="th-sort"
      onClick={onClick}
      aria-label={
        active
          ? t("quotes.sort.active", {
              label,
              direction: t(dir === "asc" ? "quotes.sort.ascending" : "quotes.sort.descending"),
            })
          : t("quotes.sort.by", { label })
      }
    >
      {label}
      {active && (dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
    </button>
  );
}

export default function Quotes({ onNew, onEdit }: { onNew: () => void; onEdit: (id: number) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const quotes = useAsync(() => LedgerService.ListQuotes(), []);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QuoteSort>({ key: "updated", dir: "desc" });
  const [actionError, setActionError, clearActionError] = useActionError();

  function toggleSort(key: QuoteSort["key"]) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" },
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
    <div>
      <div className="page-head quotes-head">
        <h1>{t("quotes.title")}</h1>
        <div className="page-head-actions">
          <input
            type="search"
            className="search-input"
            placeholder={t("quotes.searchPlaceholder")}
            aria-label={t("quotes.searchLabel")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-icon"
            aria-label={t("quotes.create")}
            title={t("quotes.create")}
            onClick={onNew}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {quotes.error ? <p className="error-text">{quotes.error}</p> : null}
      {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}

      {list.length === 0 ? (
        <div className="empty">{t("quotes.empty")}</div>
      ) : filtered.length === 0 ? (
        <div className="empty">{t("quotes.noResults", { term: search.trim() })}</div>
      ) : (
        <div className="list">
          <div className="row-head cols-quote">
            <span>
              <SortButton label={t("quotes.table.name")} active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
            </span>
            <span className="money">{t("quotes.table.margin")}</span>
            <span className="money">{t("quotes.table.finalPrice")}</span>
            <span className="money">
              <SortButton
                label={t("quotes.table.updated")}
                active={sort.key === "updated"}
                dir={sort.dir}
                onClick={() => toggleSort("updated")}
              />
            </span>
            <span />
          </div>
          {rows.map((q) => (
            <div className="list-row cols-quote" key={q.id}>
              <span>{q.name}</span>
              <span className="money">{q.marginPercent.toLocaleString(locale)}%</span>
              <span className="money price">{brl(q.finalPrice, locale)}</span>
              <span className="money muted">{dt(q.updatedAt, locale)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={t("common.editItem", { item: t("quotes.item", { name: q.name }) })}
                  title={t("common.editItem", { item: t("quotes.item", { name: q.name }) })}
                  onClick={() => onEdit(q.id)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                {confirmId === q.id ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={t("common.confirmDeleteItem", { item: t("quotes.item", { name: q.name }) })}
                    title={t("common.confirmDeleteItem", { item: t("quotes.item", { name: q.name }) })}
                    onClick={() => remove(q.id)}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={t("common.deleteItem", { item: t("quotes.item", { name: q.name }) })}
                    title={t("common.deleteItem", { item: t("quotes.item", { name: q.name }) })}
                    onClick={() => setConfirmId(q.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
