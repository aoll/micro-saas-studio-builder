import { Suspense } from "react";
import { isEditable } from "@/lib/dal/guards";
import { getPortfolioMetrics } from "@/lib/dal/metrics";
import { requireAdmin } from "@/lib/dal/session";
import { getThresholdSettings } from "@/lib/dal/thresholds";
import { SettingsSkeleton } from "./_components/settings-skeleton";
import { toSettingsView } from "./_components/settings-view";
import { ThresholdsSettings } from "./_components/thresholds-settings";

// BO-09 (specs/BO-09-seuils.md): session-gated data streams under
// <Suspense> (docs/04-nextjs.md), mirroring admin/page.tsx's own
// Portfolio() wrapper. `getPortfolioMetrics` and `getThresholdSettings`
// both call `requireAdmin()` themselves; the extra call here matches every
// other admin page in this repo (product-form/new's own comment).
async function GuardedSettings() {
  await requireAdmin();
  const [metrics, settings] = await Promise.all([getPortfolioMetrics({ days: 30 }), getThresholdSettings()]);
  const view = toSettingsView(metrics, settings, isEditable);
  return <ThresholdsSettings view={view} />;
}

export default function SettingsPage() {
  return (
    <main className="grid gap-6 p-6">
      <h1 className="text-2xl font-semibold">Réglages des seuils</h1>
      <Suspense fallback={<SettingsSkeleton />}>
        <GuardedSettings />
      </Suspense>
    </main>
  );
}
