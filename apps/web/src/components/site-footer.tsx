import Image from "next/image";
import Link from "next/link";
import { appHref, ctaTrack, pilotLink, TRAINER_PATH } from "@/lib/site";

const linkClass =
  "font-bold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";

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
            <ul className="mt-3 space-y-2">
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
          <ul className="mt-3 space-y-2">
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
        <p className="mx-auto max-w-6xl px-5 py-5 text-sm font-semibold text-muted md:px-8">
          © {new Date().getFullYear()} Affirming Antelope. Practice scenarios are fictional.
        </p>
      </div>
    </footer>
  );
}
