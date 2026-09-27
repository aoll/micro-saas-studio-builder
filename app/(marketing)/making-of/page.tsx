import type { Metadata } from "next";
import { AgentRoles } from "./_components/agent-roles";
import { ControlRoomHeader } from "./_components/control-room-header";
import { CycleCards } from "./_components/cycle-cards";
import { mono, sans } from "./_components/fonts";
import { ProcessSteps } from "./_components/process-steps";
import { RunTimeline } from "./_components/run-timeline";

// The making-of, next to the recruiter landing (same `(marketing)` root
// layout): how the demo was built by an orchestrator and its agents, in two
// cycles (implementation, then QA and fixes). A static "control room" page:
// every figure comes from the run's own logs (./_data/run.ts), so it needs no
// database and no client JavaScript.
export const metadata: Metadata = {
  title: "Making-of — Micro-SaaS Studio Builder",
  description:
    "258 agents IA, 30 heures : comment la démo a été construite par un orchestrateur, spec par spec, puis passée en QA jusqu'à zéro constat.",
  alternates: { canonical: "/making-of" },
};

export default function MakingOfPage() {
  return (
    <div
      className={`${mono.variable} ${sans.variable} min-h-dvh bg-[#0F1115] font-[family-name:var(--font-mo-sans)] text-[#E8EAEE]`}
    >
      <main className="mx-auto flex max-w-[1240px] flex-col gap-16 px-4 py-12 sm:px-8 lg:px-12">
        <ControlRoomHeader />
        <ProcessSteps />
        <RunTimeline />
        <CycleCards />
        <AgentRoles />
        <footer className="flex flex-col justify-between gap-3 border-t border-[#262B36] pt-6 text-[13px] text-[#9AA1AD] sm:flex-row">
          <span>Next.js 16 · Cache Components · Drizzle + Postgres · Better Auth · AI SDK · Vercel</span>
          <span>180 agents Sonnet · 78 agents Opus · 74 M tokens</span>
          <a
            href="https://github.com/aoll/micro-saas-studio-builder"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#E8EAEE] hover:underline"
          >
            Le code sur GitHub
          </a>
        </footer>
      </main>
    </div>
  );
}
