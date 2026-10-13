import Image from "next/image";
import Link from "next/link";
import { GetTheApp } from "./get-the-app";

const links = [
  { href: "/about", label: "About" },
  { href: "/#who-its-for", label: "Who it's for" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/guides", label: "Guides" },
];

const linkClass =
  "rounded-lg px-1 text-[15px] font-extrabold text-ink/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b-2 border-line bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <Link
          href="/"
          aria-label="Affirming Antelope home"
          className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Image
            src="/brand-lockup-horizontal-deep.svg"
            alt="Affirming Antelope"
            width={700}
            height={180}
            loading="eager"
            className="h-8 w-auto shrink-0 object-contain sm:h-9"
          />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5" aria-label="Primary">
          <ul className="hidden items-center gap-5 lg:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/about" className={`${linkClass} hidden sm:inline lg:hidden`}>
            About
          </Link>
          <Link href="/faq" className={`${linkClass} hidden md:inline lg:hidden`}>
            FAQ
          </Link>
          <GetTheApp location="nav" size="sm">
            <span className="sm:hidden">Start free</span>
            <span className="hidden sm:inline">Start practicing free</span>
          </GetTheApp>
        </nav>
      </div>
    </header>
  );
}
