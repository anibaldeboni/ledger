import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import type { ProductionColumn } from "../../bindings/ledger/internal/domain/models";
import { Card, CardContent, CardHeader } from "../components/ui/card";
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
    <Card>
      <CardHeader>
        <h2 id="production-stage-title" className="text-base font-semibold">
          {t("production.columns.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("production.columns.hint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={add}>
          <FieldGroup className="w-full">
            <Field>
              <FieldLabel htmlFor="production-new-stage">{t("production.columns.newName")}</FieldLabel>
              <Input
                id="production-new-stage"
                name="production-stage-name"
                className="h-11"
                autoComplete="off"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                disabled={busy}
                required
              />
            </Field>
          </FieldGroup>
          <Button type="submit" size="lg" className="min-h-11" disabled={busy || !newName.trim()}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            {t("production.columns.add")}
          </Button>
        </form>
        <ol className="grid gap-2">
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
      </CardContent>
    </Card>
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
    <li className="grid gap-3 border-t border-border pt-3">
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={save}>
        <FieldGroup className="w-full min-w-0">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="size-11"
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
            size="icon-lg"
            className="size-11"
            aria-label={t("production.columns.moveLater", { name: column.name })}
            title={t("production.columns.moveLater", { name: column.name })}
            disabled={busy || index === count - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown data-icon="inline-start" aria-hidden="true" />
          </Button>
          <Button type="submit" variant="outline" size="lg" className="min-h-11" disabled={busy || !canSave}>
            <Save data-icon="inline-start" aria-hidden="true" />
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-lg"
            className="size-11"
            aria-label={t("production.columns.deleteLabel", { name: column.name })}
            title={completionStage ? t("production.columns.completionProtected") : t("production.columns.deleteLabel", { name: column.name })}
            disabled={busy || completionStage}
            onClick={() => onDelete(column)}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
          </Button>
          {completionStage ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {t("production.columns.protected")}
            </span>
          ) : null}
        </div>
      </form>
    </li>
  );
}
