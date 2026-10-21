import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { BLAKE, BLAKE_QUOTE, blakeBio } from "@/lib/people";
import { breadcrumbLd, JsonLd, personLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Blake Parkinson: builder of Affirming Antelope",
  absoluteTitle: true,
  description:
    "Blake Parkinson is Head of Engineering at Big Leap Health and a cofounder of Prime Menagerie LLC. He built core infrastructure at Edmodo and builds Affirming Antelope.",
  path: BLAKE.page!,
  keywords: ["Blake Parkinson", "Affirming Antelope", "AI in healthcare engineering"],
});

const linkClass =
  "font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const cardClass =
  "block rounded-[1.25rem] border-2 border-line bg-white p-4 font-bold text-ink shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Numbers from Blake's own site. */
const STATS = [
  { value: "20+", label: "years writing software" },
  { value: "50M", label: "Edmodo users on infrastructure he built" },
  { value: "3 → 30+", label: "engineers as CTO of Backbone PLM" },
];

const LINKS = [
  { href: "https://www.linkedin.com/in/bparky", label: "LinkedIn" },
  { href: "https://github.com/blakeparkinson", label: "GitHub" },
  { href: "https://www.yourbuddyblake.com", label: "yourbuddyblake.com" },
];

export default function BlakeParkinsonPage() {
  const photo = BLAKE.photo!;

  return (
    <>
      <JsonLd
        data={[
          personLd(BLAKE),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
            { name: BLAKE.displayName, path: BLAKE.page! },
          ]),
        ]}
      />
      <SiteNav />
      <main>
        <header className="border-b-2 border-line bg-soft">
          <div className="mx-auto max-w-6xl px-5 pt-8 pb-12 md:px-8 md:pt-10 md:pb-16">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink/80">
                <li>
                  <Link href="/" className="-my-3 inline-block py-3 hover:text-ink">
                    Home
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href="/about" className="-my-3 inline-block py-3 hover:text-ink">
                    About
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink">
                  {BLAKE.name}
                </li>
              </ol>
            </nav>
            <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes="(min-width: 768px) 176px, 128px"
                preload
                className="size-32 shrink-0 rounded-full border-4 border-white object-cover shadow-[0_5px_0_var(--shadow)] md:size-44"
              />
              <div>
                <h1 className="pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl">
                  {BLAKE.displayName}
                </h1>
                <p className="mt-2 text-lg font-extrabold leading-snug text-primary-shadow">
                  {BLAKE.jobTitle} at {BLAKE.employer!.name}
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug text-ink/80 md:text-xl">
                  Builds Affirming Antelope
                </p>
              </div>
            </div>
          </div>
        </header>

        <section aria-label="By the numbers" className="border-b-2 border-line">
          <dl className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-5 py-10 sm:grid-cols-3 md:px-8">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col-reverse justify-end rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_4px_0_var(--shadow)]"
              >
                <dt className="mt-1 text-sm font-bold leading-snug text-muted">{s.label}</dt>
                <dd className="font-display text-3xl font-bold tabular-nums tracking-tight text-primary md:text-4xl">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-12">
          <div className="max-w-[62ch] lg:col-span-7">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">Background</h2>
            <div className="mt-4 space-y-5 text-lg font-semibold leading-relaxed text-ink/80">
              {blakeBio().map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>

            <figure className="mt-8 max-w-xs">
              <Image
                src="/team/blake-parkinson-5k.jpg"
                alt="Blake Parkinson at the Estes Park 5K, next to a duck mascot in a cowboy hat"
                width={400}
                height={400}
                sizes="320px"
                className="aspect-square w-full rounded-[2rem] border-2 border-line object-cover shadow-[0_5px_0_var(--shadow)]"
              />
              <figcaption className="mt-3 text-sm font-bold leading-snug text-muted">
                Estes Park 5K. Blake is the one without the cowboy hat.
              </figcaption>
            </figure>

            <blockquote className="mt-8 border-l-4 border-primary pl-5 font-display text-xl font-semibold leading-snug text-ink">
              &ldquo;{BLAKE_QUOTE}&rdquo;
              <footer className="mt-2 font-sans text-base font-bold text-muted">{BLAKE.displayName}</footer>
            </blockquote>

            <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener me" className={linkClass}>
                  {l.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </p>
          </div>

          <aside className="lg:col-span-5" aria-labelledby="next-heading">
            <h2 id="next-heading" className="font-display text-xl font-bold text-ink">
              See what he built
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/scenarios" className={cardClass}>
                  Role-play scenarios
                  <span className="mt-1 block text-sm font-semibold text-muted">The people you practice with</span>
                </Link>
              </li>
              <li>
                <Link href="/guides" className={cardClass}>
                  MI guides
                  <span className="mt-1 block text-sm font-semibold text-muted">Each skill, with example dialogue</span>
                </Link>
              </li>
              <li>
                <Link href="/about/amanda-roth" className={cardClass}>
                  Amanda Roth, LCSW
                  <span className="mt-1 block text-sm font-semibold text-muted">Who designed the program</span>
                </Link>
              </li>
              <li>
                <Link href="/about" className={linkClass}>
                  About Affirming Antelope
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
