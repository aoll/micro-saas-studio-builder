import { SettingsSkeleton } from "./_components/settings-skeleton";

// Overrides admin/loading.tsx's generic portfolio-shaped fallback (plan's
// risk table) with the shape of this page's own two forms.
export default function SettingsLoading() {
  return (
    <main className="grid gap-6 p-6">
      <SettingsSkeleton />
    </main>
  );
}
