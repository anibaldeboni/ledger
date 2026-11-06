import { useState } from "react";
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
        <button className="btn btn-primary" onClick={onNew}>
          Novo orçamento
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
              <button
                className="btn-ghost"
                style={{ textAlign: "left", font: "inherit", padding: 0 }}
                onClick={() => onEdit(q.id)}
              >
                {q.name}
              </button>
              <span className="money">{q.marginPercent.toLocaleString("pt-BR")}%</span>
              <span className="money price">{brl(q.finalPrice)}</span>
              <span className="money muted">{dt(q.updatedAt)}</span>
              <span className="actions" style={{ justifySelf: "end" }}>
                {confirmId === q.id ? (
                  <button className="btn btn-danger btn-sm" onClick={() => remove(q.id)}>
                    Confirmar exclusão
                  </button>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmId(q.id)}>
                    Excluir
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
