import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import type { ProductionColumn } from "../../bindings/ledger/internal/domain/models";
import { Button } from "../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../components/ui/field";
import { Input } from "../components/ui/input";

type Props = {
  columns: ProductionColumn[];
  busy: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onSave: (column: ProductionColumn, name: string) => Promise<boolean>;
  onMove: (index: number, offset: -1 | 1) => void;
  onDelete: (column: ProductionColumn) => void;
};

export default function ProductionStageManager({ columns, busy, onAdd, onSave, onMove, onDelete }: Props) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name && (await onAdd(name))) setNewName("");
  }

  return (
    <section className="production-stage-manager" aria-labelledby="production-stage-title">
      <h2 id="production-stage-title">{t("production.columns.title")}</h2>
      <p className="hint">{t("production.columns.hint")}</p>
      <form className="production-stage-add" onSubmit={add}>
        <FieldGroup className="production-stage-fields">
          <Field>
            <FieldLabel htmlFor="production-new-stage">{t("production.columns.newName")}</FieldLabel>
            <Input
              id="production-new-stage"
              name="production-stage-name"
              autoComplete="off"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              disabled={busy}
              required
            />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={busy || !newName.trim()}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          {t("production.columns.add")}
        </Button>
      </form>
      <ol className="production-stage-list">
        {columns.map((column, index) => (
          <StageEditor
            key={`${column.id}:${column.name}`}
            column={column}
            index={index}
            count={columns.length}
            busy={busy}
            onSave={onSave}
            onMove={onMove}
            onDelete={onDelete}
          />
        ))}
      </ol>
    </section>
  );
}

function StageEditor({
  column,
  index,
  count,
  busy,
  onSave,
  onMove,
  onDelete,
}: {
  column: ProductionColumn;
  index: number;
  count: number;
  busy: boolean;
  onSave: Props["onSave"];
  onMove: Props["onMove"];
  onDelete: Props["onDelete"];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(column.name);
  const trimmedName = name.trim();
  const canSave = Boolean(trimmedName) && trimmedName !== column.name;
  const completionStage = column.systemKey === "completed";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) await onSave(column, trimmedName);
  }

  return (
    <li className="production-stage-row">
      <form onSubmit={save}>
        <FieldGroup className="production-stage-name-group">
          <Field>
            <FieldLabel htmlFor={`production-stage-${column.id}`}>
              {t("production.columns.renameLabel", { name: column.name })}
            </FieldLabel>
            <Input
              id={`production-stage-${column.id}`}
              name={`production-stage-${column.id}`}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </Field>
        </FieldGroup>
        <div className="actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("production.columns.moveEarlier", { name: column.name })}
            title={t("production.columns.moveEarlier", { name: column.name })}
            disabled={busy || index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp data-icon="inline-start" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("production.columns.moveLater", { name: column.name })}
            title={t("production.columns.moveLater", { name: column.name })}
            disabled={busy || index === count - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown data-icon="inline-start" aria-hidden="true" />
          </Button>
          <Button type="submit" variant="outline" size="sm" disabled={busy || !canSave}>
            <Save data-icon="inline-start" aria-hidden="true" />
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label={t("production.columns.deleteLabel", { name: column.name })}
            title={completionStage ? t("production.columns.completionProtected") : t("production.columns.deleteLabel", { name: column.name })}
            disabled={busy || completionStage}
            onClick={() => onDelete(column)}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
          </Button>
          {completionStage ? <span className="production-stage-protected">{t("production.columns.protected")}</span> : null}
        </div>
      </form>
    </li>
  );
}
