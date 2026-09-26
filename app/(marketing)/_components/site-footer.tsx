import Link from "next/link";

// Contact links from docs/00-accueil.md's "À propos de moi", plus a repeated
// path back to the backoffice for a recruiter who scrolled past the hero.
export function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p>Alexandre Ollivier — développeur fullstack senior</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href="mailto:agollivier@gmail.com" className="hover:text-foreground hover:underline">
            agollivier@gmail.com
          </a>
          <a
            href="https://github.com/aoll"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/alexandre-ollivier-64b925285"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground hover:underline"
          >
            LinkedIn
          </a>
          <Link href="/admin/login" className="hover:text-foreground hover:underline">
            Backoffice admin
          </Link>
        </nav>
        <p className="text-xs">Démo de candidature : le paiement et l&apos;email y sont simulés.</p>
      </div>
    </footer>
  );
}
