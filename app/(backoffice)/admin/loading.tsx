import { PortfolioSkeleton } from "./_components/portfolio/portfolio-skeleton";

// Generic admin skeleton (specs/BO-02-portefeuille.md plan, risk table:
// "admin/loading.tsx wraps nested admin routes"): every route under
// /admin uses this shape until its own page ships a tighter one.
export default function AdminLoading() {
  return (
    <main className="grid gap-6 p-6">
      <PortfolioSkeleton />
    </main>
  );
}
