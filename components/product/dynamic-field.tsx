import type { ProductConfig } from "@/lib/schemas/product-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Field = ProductConfig["inputs"][number];

// One rendering per field type, generated from the product's config
// (docs/02-ecrans.md › Champ dynamique). No "use client": Server Actions
// power the outil's form, so it still works before JavaScript loads
// (docs/04-nextjs.md).
export function DynamicField({ field, error, defaultValue }: { field: Field; error?: string; defaultValue?: string }) {
  const inputId = `field-${field.key}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const shared = {
    id: inputId,
    name: field.key,
    required: field.required,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": errorId,
    defaultValue,
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{field.label}</Label>
      {field.type === "text" ? <Input type="text" maxLength={field.maxLength} {...shared} /> : null}
      {field.type === "textarea" ? <Textarea maxLength={field.maxLength} {...shared} /> : null}
      {field.type === "select" ? (
        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" {...shared}>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
