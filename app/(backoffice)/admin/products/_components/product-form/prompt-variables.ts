// BO-05 step 5's clickable `{{variables}}` (docs/02-ecrans.md): inserting a
// chip replaces the current textarea selection (or, with no selection,
// inserts at the caret) with `{{key}}`, and reports where the caret should
// land afterwards — right after the inserted text, so typing continues
// naturally.
export function insertVariable(
  template: string,
  selectionStart: number,
  selectionEnd: number,
  key: string,
): { value: string; caret: number } {
  const token = `{{${key}}}`;
  const value = template.slice(0, selectionStart) + token + template.slice(selectionEnd);
  return { value, caret: selectionStart + token.length };
}
