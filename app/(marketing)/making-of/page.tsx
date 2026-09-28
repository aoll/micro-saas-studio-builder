import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/marketing-navigation";
import { AgentRoles } from "./_components/agent-roles";
import { ControlRoomHeader } from "./_components/control-room-header";
import { CycleCards } from "./_components/cycle-cards";
import { ProcessSteps } from "./_components/process-steps";
import { RunTimeline } from "./_components/run-timeline";

// The making-of, next to the recruiter landing (same `(marketing)` root
// layout): how the demo was built by an orchestrator and its agents, in two
// cycles (implementation, then QA and fixes). A static page:
// every figure comes from the run's own logs (./_data/run.ts), so it needs no
// database and no client JavaScript. Same light "bleu diffus" look as the
// landing, from the marketing root layout.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("making-of.metadata");
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      // See app/(marketing)/page.tsx's generateMetadata for why `fr` has no
      // `forcePrefix` (nextjs-reviewer finding): it must mirror `canonical`.
      canonical: getPathname({ href: "/making-of", locale: "fr" }),
      languages: {
        fr: getPathname({ href: "/making-of", locale: "fr" }),
        en: getPathname({ href: "/making-of", locale: "en", forcePrefix: true }),
        "x-default": "/making-of",
      },
    },
  };
}

export default async function MakingOfPage() {
  const t = await getTranslations("making-of.footer");
  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-16 px-4 py-12 sm:px-8 lg:px-12">
      <ControlRoomHeader />
      <ProcessSteps />
      <RunTimeline />
      <CycleCards />
      <AgentRoles />
      <footer className="flex flex-col justify-between gap-3 border-t border-mk-line pt-6 text-[13px] text-mk-muted sm:flex-row">
        <span>{t("stack")}</span>
        <span>{t("usage")}</span>
        <a
          href="https://github.com/aoll/micro-saas-studio-builder"
          target="_blank"
          rel="noreferrer"
          className="hover:text-mk-link hover:underline"
        >
          {t("github")}
        </a>
      </footer>
    </main>
  );
}
