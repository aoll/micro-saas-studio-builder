import { Suspense } from "react";
import { requireAdmin } from "@/lib/dal/session";

async function AdminEmail() {
  const session = await requireAdmin();
  return <p>{session.user.email}</p>;
}

export default function AdminPortfolioPage() {
  return (
    <main>
      <h1>Portefeuille</h1>
      <Suspense fallback={<p>Chargement…</p>}>
        <AdminEmail />
      </Suspense>
    </main>
  );
}
