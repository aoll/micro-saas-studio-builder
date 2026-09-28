import { getTranslations } from "next-intl/server";
import { SINCE_LAUNCH_ITEMS } from "../_data/run";

// What shipped after run v1 reached `main` (docs/README.md, _data/run.ts's
// own comment): not one more giant run, several separate workstreams —
// invoicing's job pool, the /architecture code explorer, the landing, this
// page itself, and the fr/en translation this session added. Same plain
// card grid as AgentRoles, one card per item, title and body from
// messages/{fr,en}/making-of.json's sinceLaunch.items.<id>.
export async function SinceLaunch() {
  const [t, tItems] = await Promise.all([
    getTranslations("making-of.sinceLaunch"),
    getTranslations("making-of.sinceLaunch.items"),
  ]);
  return (
    <section aria-labelledby="mo-since-launch" className="flex flex-col gap-5">
      <h2
        id="mo-since-launch"
        className="font-[family-name:var(--font-mk-mono)] text-sm tracking-[0.1em] text-mk-muted uppercase"
      >
        {t("heading")}
      </h2>
      <p className="max-w-3xl text-[15px] leading-relaxed text-mk-muted">{t("intro")}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SINCE_LAUNCH_ITEMS.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-[10px] border border-mk-line bg-mk-surface/80 px-[18px] py-4"
          >
            <span className="font-semibold">{tItems(`${item.id}.title`)}</span>
            <span className="text-[13px] leading-relaxed text-mk-muted">{tItems(`${item.id}.body`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
