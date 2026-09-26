// Reuses, verbatim, the numbers already committed to docs/00-accueil.md
// ("La démo en chiffres") rather than inventing new marketing copy.
const NUMBERS = [
  { value: "17", label: "écrans conçus" },
  { value: "4", label: "thèmes partagés" },
  { value: "< 2 $", label: "de coût IA" },
  { value: "~14,5 j", label: "de delivery agentique" },
];

export function KeyNumbers() {
  return (
    <section className="border-y bg-muted/30 py-10">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 text-center sm:grid-cols-4">
        {NUMBERS.map((number) => (
          <div key={number.label}>
            <p className="text-3xl font-bold tracking-tight">{number.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{number.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
