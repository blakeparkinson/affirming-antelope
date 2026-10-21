import Image from "next/image";
import Link from "next/link";
import { appHref, ctaTrack, pilotLink, TRAINER_PATH } from "@/lib/site";

// min-h-11: every footer link is a 44 px tap target.
const linkClass =
  "inline-flex min-h-11 items-center font-bold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";

// Affirming Antelope is a Prime Menagerie app; the studio site holds the
// privacy policy and support page that cover it.
const STUDIO = "https://primemenagerie.com";

const columns = [
  {
    heading: "Who it's for",
    links: [
      { href: "/for/leaders", label: "Healthcare leaders" },
      { href: "/for/trainers", label: "MI trainers" },
      { href: "/for/clinicians", label: "Clinicians" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { href: "/guides", label: "MI guides" },
      { href: "/scenarios", label: "Role-play scenarios" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/about", label: "About us" },
      { href: "/about/amanda-roth", label: "Amanda Roth" },
      { href: "/about/blake-parkinson", label: "Blake Parkinson" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-12 md:px-8">
        <div className="md:col-span-4">
          <Image
            src="/brand-lockup-horizontal-deep.svg"
            alt="Affirming Antelope"
            width={700}
            height={180}
            className="h-8 w-auto"
          />
          <p className="mt-4 max-w-[34ch] font-semibold text-muted">
            Daily Motivational Interviewing practice for healthcare leaders and
            the trainers who coach them. Free for learners, in your browser.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="md:col-span-2">
            <p className="font-display font-bold text-ink">{col.heading}</p>
            <ul className="mt-0.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Get started" className="md:col-span-2">
          <p className="font-display font-bold text-ink">Get started</p>
          <ul className="mt-0.5">
            <li>
              <a href={appHref("footer")} {...ctaTrack("footer", "app")} className={linkClass}>
                Start practicing free
              </a>
            </li>
            <li>
              <Link href={TRAINER_PATH} prefetch={false} {...ctaTrack("footer", "trainer", "trainers")} className={linkClass}>
                Trainer dashboard
              </Link>
            </li>
            <li>
              <a {...pilotLink("footer")} className={linkClass}>
                Book a 30-minute call
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t-2 border-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5 text-sm font-semibold text-muted md:px-8">
          <p>© {new Date().getFullYear()} Affirming Antelope. Practice scenarios are fictional.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5">
            <a href={`${STUDIO}/privacy#affirming-antelope`} className={linkClass}>Privacy</a>
            <a href={`${STUDIO}/support#affirming-antelope`} className={linkClass}>Support</a>
            <a href={STUDIO} className={linkClass}>A Prime Menagerie app</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
