import { AGENT_ROLES } from "../_data/run";

const LARGEST_ROLE = Math.max(...AGENT_ROLES.map((role) => role.count));

export function AgentRoles() {
  return (
    <section aria-labelledby="mo-roles" className="flex flex-col gap-5">
      <h2
        id="mo-roles"
        className="font-[family-name:var(--font-mo-mono)] text-sm tracking-[0.1em] text-[#9AA1AD] uppercase"
      >
        03 · L&apos;équipe d&apos;agents
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_ROLES.map((role) => (
          <li
            key={role.role}
            className="flex flex-col gap-2.5 rounded-[10px] border border-[#262B36] bg-[#171A21] px-[18px] py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-[family-name:var(--font-mo-mono)] text-sm font-semibold">{role.role}</span>
              <span className="font-[family-name:var(--font-mo-mono)] text-[22px] tabular-nums">{role.count}</span>
            </div>
            <span aria-hidden="true" className="h-1.5 rounded-[3px] bg-[#262B36]">
              <span
                className="block h-1.5 rounded-[3px] bg-[#8DB5FF]"
                style={{ width: `${((role.count / LARGEST_ROLE) * 100).toFixed(1)}%` }}
              />
            </span>
            <span className="text-[13px] text-[#9AA1AD]">{role.job}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
