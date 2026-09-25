// Prompt safety (docs/05-ia.md › Sûreté des entrées et des sorties): user
// input is placed in delimited tags and described as data, never as
// instructions. `&`, `<` and `>` are escaped so a value cannot forge a
// closing tag and smuggle instructions into the prompt.
function escapeForTag(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Replaces every `{{variable}}` in `template` with `<variable>value</variable>`;
// a variable missing from `input` renders an empty tag rather than throwing
// (a product's config already guarantees every template variable has a
// matching field, per productConfigSchema's superRefine — but the value
// itself is only ever optional user input).
export function renderPrompt(template: string, input: Record<string, string>): string {
  return template.replaceAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    const value = input[name] ?? "";
    return `<${name}>${escapeForTag(value)}</${name}>`;
  });
}
