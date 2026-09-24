// docs/02-ecrans.md › Footer produit: name + link to the studio's other
// products. No `new Date()`: a copyright year would make this component
// (and the statically pre-rendered landing that includes it) dynamic
// (docs/04-nextjs.md, risks table). The studio's own listing page isn't in
// the dossier (orchestrator decision, CONTRACT-ui resume): no link to a
// page that doesn't exist, just the product's own name.
export function ProductFooter({ name }: { name: string }) {
  return (
    <footer className="border-t px-4 py-6 text-sm text-muted-foreground">
      <p>{name}</p>
    </footer>
  );
}
