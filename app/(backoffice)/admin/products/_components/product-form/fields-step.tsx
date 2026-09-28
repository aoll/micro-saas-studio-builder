"use client";

import { useTranslations } from "next-intl";
import { MAX_INPUTS } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moveItem, type FieldDraft } from "./form-values";

const MIN_INPUTS = 1;
const FIELD_TYPES: FieldDraft["type"][] = ["text", "textarea", "select"];

// BO-05 step 4 (docs/02-ecrans.md): the outil's own mini form-builder, one
// row per field, reordered by up/down buttons.
export function FieldsStep({
  fields,
  errors,
  onChange,
}: {
  fields: FieldDraft[];
  errors: Record<string, string>;
  onChange: (fields: FieldDraft[]) => void;
}) {
  const t = useTranslations("backoffice-product-form-a");
  // Type labels are chrome (docs/02-ecrans.md's field types), unlike the
  // "Champ N" default label below (product content, out of this lot's
  // scope per specs/I18N-BACKOFFICE-STRINGS.md's Décisions de portée).
  const typeLabels: Record<FieldDraft["type"], string> = {
    text: t("fieldsStep.types.text"),
    textarea: t("fieldsStep.types.textarea"),
    select: t("fieldsStep.types.select"),
  };

  function updateField(index: number, patch: Partial<FieldDraft>) {
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function addField() {
    const key = `champ_${fields.length + 1}`;
    onChange([
      ...fields,
      { id: crypto.randomUUID(), key, label: `Champ ${fields.length + 1}`, type: "text", required: false },
    ]);
  }

  function removeField(index: number) {
    onChange(fields.filter((_field, i) => i !== index));
  }

  return (
    <div className="grid gap-4">
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`field-key-${field.id}`}>{t("fieldsStep.keyLabel")}</Label>
              <Input
                id={`field-key-${field.id}`}
                value={field.key}
                onChange={(event) => updateField(index, { key: event.target.value })}
                aria-invalid={errors[`inputs.${index}.key`] ? "true" : undefined}
              />
              {errors[`inputs.${index}.key`] ? (
                <p className="text-sm text-destructive">{errors[`inputs.${index}.key`]}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`field-label-${field.id}`}>{t("fieldsStep.labelLabel")}</Label>
              <Input
                id={`field-label-${field.id}`}
                value={field.label}
                onChange={(event) => updateField(index, { label: event.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`field-type-${field.id}`}>{t("fieldsStep.typeLabel")}</Label>
              <select
                id={`field-type-${field.id}`}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={field.type}
                onChange={(event) => updateField(index, { type: event.target.value as FieldDraft["type"] })}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-1.5 text-sm">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) => updateField(index, { required: event.target.checked })}
              />
              {t("fieldsStep.requiredLabel")}
            </label>
          </div>

          {field.type === "select" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`field-options-${field.id}`}>{t("fieldsStep.optionsLabel")}</Label>
              <Textarea
                id={`field-options-${field.id}`}
                value={(field.options ?? []).join("\n")}
                onChange={(event) => updateField(index, { options: event.target.value.split("\n") })}
                aria-invalid={errors[`inputs.${index}.options`] ? "true" : undefined}
              />
              {errors[`inputs.${index}.options`] ? (
                <p className="text-sm text-destructive">{errors[`inputs.${index}.options`]}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => onChange(moveItem(fields, index, "up"))}
            >
              {t("common.moveUp")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === fields.length - 1}
              onClick={() => onChange(moveItem(fields, index, "down"))}
            >
              {t("common.moveDown")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={fields.length <= MIN_INPUTS}
              onClick={() => removeField(index)}
            >
              {t("fieldsStep.removeField")}
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" disabled={fields.length >= MAX_INPUTS} onClick={addField}>
        {t("fieldsStep.addField")}
      </Button>
    </div>
  );
}
