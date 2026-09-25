export type ModelOption = { value: string; label: string };

// BO-05 step 5's model picker (docs/05-ia.md): Claude Haiku 4.5 is the
// demo's default, Sonnet 5 its "premium" step up. Shared between the
// picker (GenerationStep, which also allows a product's already-stored
// model as a third option) and the server-side allow-list in `_actions.ts`
// (security review, LOW): the frozen `generation.model` schema only checks
// `z.string().min(1)`, so the actions themselves reject any model outside
// this catalogue, except the model already on the product being edited.
export const MODEL_CATALOGUE: ModelOption[] = [
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { value: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
];

export const MODEL_CATALOGUE_VALUES: readonly string[] = MODEL_CATALOGUE.map((option) => option.value);
