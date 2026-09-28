import type { ProductConfig } from "@/lib/schemas/product-config";

type Field = ProductConfig["inputs"][number];

// docs/05-ia.md › Sûreté des entrées et des sorties: a product's config has
// no way to set a maxLength from BO-05, so a field without one would only
// be bound by the 5 000-char global limit, wide open to a long injection
// payload. `select` has no default: it is already bound to its `options`.
const DEFAULT_MAX_LENGTH: Partial<Record<Field["type"], number>> = { text: 150, textarea: 1500 };

export type ToolInputIssueCode = "required" | "too_long" | "invalid_option" | "unknown_field";
export type ToolInputFieldErrors = Record<string, ToolInputIssueCode>;
export type ToolInputResult =
  { success: true; data: Record<string, string> } | { success: false; fieldErrors: ToolInputFieldErrors };

// Pure function, shared by the client form (SA-02's ToolForm, immediate
// feedback) and the route handler (api/generate, the real gate): validates
// a submission against `config.inputs`, the same fields DynamicField
// renders. Issue codes rather than messages, so each caller translates them
// with its own next-intl namespace.
export function toolInputSchema(fields: Field[], input: Record<string, string>): ToolInputResult {
  const knownKeys = new Set(fields.map((field) => field.key));
  const fieldErrors: ToolInputFieldErrors = {};

  for (const key of Object.keys(input)) {
    if (!knownKeys.has(key)) fieldErrors[key] = "unknown_field";
  }

  const data: Record<string, string> = {};
  for (const field of fields) {
    const raw = input[field.key] ?? "";

    if (field.required && raw.trim().length === 0) {
      fieldErrors[field.key] = "required";
      continue;
    }
    const maxLength = field.maxLength ?? DEFAULT_MAX_LENGTH[field.type];
    if (maxLength !== undefined && raw.length > maxLength) {
      fieldErrors[field.key] = "too_long";
      continue;
    }
    if (field.type === "select" && raw.trim().length > 0 && !(field.options ?? []).includes(raw)) {
      fieldErrors[field.key] = "invalid_option";
      continue;
    }

    data[field.key] = raw;
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data };
}
