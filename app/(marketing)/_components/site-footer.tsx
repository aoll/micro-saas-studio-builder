import Link from "next/link";

// Contact links from docs/00-accueil.md's "À propos de moi", plus a repeated
// path back to the backoffice for a recruiter who scrolled past the hero.
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-mk-line">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-4 py-10 text-sm text-mk-muted sm:px-8 lg:flex-row">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-mk-ink">Alexandre Ollivier — développeur fullstack senior</p>
          <p className="text-[13px]">Démo de candidature : le paiement et l&apos;email y sont simulés.</p>
        </div>
        <nav className="flex flex-wrap items-start gap-x-5 gap-y-2 font-medium">
          <a href="mailto:agollivier@gmail.com" className="hover:text-mk-link hover:underline">
            agollivier@gmail.com
          </a>
          <a
            href="https://github.com/aoll"
            target="_blank"
            rel="noreferrer"
            className="hover:text-mk-link hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/alexandre-ollivier-64b925285"
            target="_blank"
            rel="noreferrer"
            className="hover:text-mk-link hover:underline"
          >
            LinkedIn
          </a>
          <Link href="/making-of" className="hover:text-mk-link hover:underline">
            Making-of
          </Link>
          <a
            href="/architecture/index.html"
            target="_blank"
            rel="noreferrer"
            className="hover:text-mk-link hover:underline"
          >
            Architecture
          </a>
          <Link href="/admin/login" className="hover:text-mk-link hover:underline">
            Backoffice admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
