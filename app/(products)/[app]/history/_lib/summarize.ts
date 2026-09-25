import type { z } from "zod";
import type { inputFieldSchema } from "@/lib/schemas/product-config";

type InputField = z.infer<typeof inputFieldSchema>;

// SA-06's history list row is a summary, not the full generation (plan §
// "reachable at all times, in DAL order"). This is pure UI formatting, no
// DAL access, so it is colocated under the route instead of lib/dal.

// Joins a generation's input values in the product's own field order
// (config.inputs), then appends any key not declared in that config (an
// older config, a stray value) in the order it appears in the input object.
// Blank or missing values are skipped. The joined result is truncated by
// Unicode code point, so multi-byte characters near the cut are never split.
export function summarizeInput(
  input: Record<string, string>,
  fields: Pick<InputField, "key" | "label">[],
  max = 80,
): string {
  const knownKeys = new Set(fields.map((field) => field.key));
  const parts: string[] = [];

  for (const field of fields) {
    const value = input[field.key];
    if (value) parts.push(`${field.label} : ${value}`);
  }
  for (const [key, value] of Object.entries(input)) {
    if (!knownKeys.has(key) && value) parts.push(`${key} : ${value}`);
  }

  return truncate(parts.join(" · "), max);
}

// Collapses runs of whitespace (including newlines) from a result's start,
// then truncates by code point.
export function excerpt(text: string, max = 120): string {
  return truncate(text.replace(/\s+/g, " ").trim(), max);
}

function truncate(text: string, max: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= max) return text;
  return `${codePoints.slice(0, max).join("")}…`;
}
