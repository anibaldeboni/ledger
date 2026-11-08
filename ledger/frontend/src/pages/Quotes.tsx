import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { LedgerService } from "../../bindings/ledger";
import { brl, dt } from "../lib/format";
import { useActionError, useAsync } from "../lib/hooks";

export default function Quotes({ onNew, onEdit }: { onNew: () => void; onEdit: (id: number) => void }) {
  const quotes = useAsync(() => LedgerService.ListQuotes(), []);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [actionError, setActionError, clearActionError] = useActionError();

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

  return (
    <div>
      <div className="page-head">
        <h1>Orçamentos</h1>
        <button
          type="button"
          className="btn btn-primary btn-icon"
          aria-label="Criar novo orçamento"
          title="Criar novo orçamento"
          onClick={onNew}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {quotes.error ? <p className="error-text">{quotes.error}</p> : null}
      {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}

      {list.length === 0 ? (
        <div className="empty">Nenhum orçamento ainda. Crie o primeiro para calcular o preço de uma impressão.</div>
      ) : (
        <div className="list">
          <div className="row-head cols-quote">
            <span>Nome</span>
            <span className="money">Margem</span>
            <span className="money">Preço final</span>
            <span className="money">Atualizado</span>
            <span />
          </div>
          {list.map((q) => (
            <div className="list-row cols-quote" key={q.id}>
              <span>{q.name}</span>
              <span className="money">{q.marginPercent.toLocaleString("pt-BR")}%</span>
              <span className="money price">{brl(q.finalPrice)}</span>
              <span className="money muted">{dt(q.updatedAt)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Editar orçamento ${q.name}`}
                  title={`Editar orçamento ${q.name}`}
                  onClick={() => onEdit(q.id)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                {confirmId === q.id ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={`Confirmar exclusão do orçamento ${q.name}`}
                    title={`Confirmar exclusão do orçamento ${q.name}`}
                    onClick={() => remove(q.id)}
                  >
                    <Check size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger btn-icon"
                    aria-label={`Excluir orçamento ${q.name}`}
                    title={`Excluir orçamento ${q.name}`}
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
