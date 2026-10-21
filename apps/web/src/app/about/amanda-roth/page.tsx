import { MI_FOR_LEADERS } from "@antelope/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AMANDA, AMANDA_QUOTE, amandaBio } from "@/lib/people";
import { breadcrumbLd, JsonLd, personLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Amanda Roth, LCSW: designer of MI for Leaders",
  absoluteTitle: true,
  description:
    "Amanda Roth, LCSW, is Principal, Psychotherapy Clinical Quality, and designed the MI for Leaders program that Affirming Antelope's practice path follows.",
  path: AMANDA.page!,
  keywords: ["Amanda Roth LCSW", "MI for Leaders", "motivational interviewing for healthcare leaders"],
});

const linkClass =
  "font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const cardClass =
  "block rounded-[1.25rem] border-2 border-line bg-white p-4 font-bold text-ink shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AmandaRothPage() {
  const photo = AMANDA.photo!;
  const weeks = MI_FOR_LEADERS.units.length;
  const linkedIn = AMANDA.sameAs[0];

  return (
    <>
      <JsonLd
        data={[
          personLd(AMANDA),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
            { name: AMANDA.displayName, path: AMANDA.page! },
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
                  {AMANDA.name}
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
                  {AMANDA.displayName}
                </h1>
                <p className="mt-2 text-lg font-extrabold leading-snug text-primary-shadow">{AMANDA.credentialLine}</p>
                <p className="mt-1 text-lg font-semibold leading-snug text-ink/80 md:text-xl">{AMANDA.jobTitle}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-12">
          <div className="max-w-[62ch] lg:col-span-7">
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink">Background</h2>
            <div className="mt-4 space-y-5 text-lg font-semibold leading-relaxed text-ink/80">
              {amandaBio().map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>

            {AMANDA_QUOTE ? (
              <blockquote className="mt-8 border-l-4 border-primary pl-5 font-display text-xl font-semibold leading-snug text-ink">
                &ldquo;{AMANDA_QUOTE}&rdquo;
                <footer className="mt-2 font-sans text-base font-bold text-muted">{AMANDA.displayName}</footer>
              </blockquote>
            ) : null}

            {linkedIn && (
              <p className="mt-8">
                <a href={linkedIn} target="_blank" rel="noopener me" className={linkClass}>
                  LinkedIn
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </div>

          <aside className="lg:col-span-5" aria-labelledby="next-heading">
            <h2 id="next-heading" className="font-display text-xl font-bold text-ink">
              Start from her program
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/for/leaders" className={cardClass}>
                  Motivational interviewing for healthcare leaders
                  <span className="mt-1 block text-sm font-semibold text-muted">The {weeks}-week MI for Leaders path</span>
                </Link>
              </li>
              <li>
                <Link href="/guides" className={cardClass}>
                  MI guides
                  <span className="mt-1 block text-sm font-semibold text-muted">Each skill, with example dialogue</span>
                </Link>
              </li>
              <li>
                <Link href="/scenarios" className={cardClass}>
                  Role-play scenarios
                  <span className="mt-1 block text-sm font-semibold text-muted">Read how each employee opens</span>
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
