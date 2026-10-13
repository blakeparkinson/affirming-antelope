import Image from "next/image";
import Link from "next/link";
import { scenarioCount } from "@/lib/audiences";
import { AMANDA, AMANDA_QUOTE } from "@/lib/people";
import { Reveal } from "../reveal";

/**
 * The person behind the method. Facts come from lib/people.ts.
 */
export const METHOD_LEAD = {
  name: AMANDA.displayName,
  role: AMANDA.jobTitle,
  photo: AMANDA.photo!,
  alt: AMANDA.photo!.alt,
  // Drafted for Amanda: she approves the wording before this merges. Renders only when non-empty.
  quote: AMANDA_QUOTE,
};

// From the PM-017 spec in packages/core/src/scenarios.ts (sustain and change triggers).
const spec = {
  shuts: [
    "Lecturing about the impact on the finance team",
    "Offering solutions before understanding",
    "Defending the promotion decision",
  ],
  opens: [
    "Reflecting the frustration under his flat answers",
    "Affirming his track record specifically",
    "Emphasizing that how he handles this is his choice",
  ],
};

export function Method() {
  const { quote } = METHOD_LEAD;

  return (
    <section aria-labelledby="method-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:items-center">
        <Reveal className="lg:col-span-6">
          <h2
            id="method-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-[2.6rem]"
          >
            Why we built it
          </h2>
          <p className="mt-4 max-w-[46ch] text-lg font-semibold leading-relaxed text-ink/80">
            Designed from the MI for Leaders program{" "}
            <Link
              href={AMANDA.page!}
              className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Amanda Roth
            </Link>{" "}
            teaches. Every
            employee is written from a scenario spec: who they are, what shuts
            them down, and what helps them open up.
          </p>

          {quote ? (
            <blockquote className="mt-8 max-w-[46ch] border-l-4 border-primary pl-5 font-display text-xl font-semibold leading-snug text-ink">
              &ldquo;{quote}&rdquo;
            </blockquote>
          ) : null}

          <div className="mt-8 flex items-center gap-5">
            <Image
              src={METHOD_LEAD.photo.src}
              alt={METHOD_LEAD.alt}
              width={METHOD_LEAD.photo.width}
              height={METHOD_LEAD.photo.height}
              sizes="96px"
              className="size-24 shrink-0 rounded-full border-4 border-white object-cover shadow-[0_4px_0_var(--shadow)]"
            />
            <div>
              <p className="font-display text-xl font-bold text-ink">
                <Link
                  href={AMANDA.page!}
                  className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {METHOD_LEAD.name}
                </Link>
              </p>
              <p className="mt-0.5 text-sm font-extrabold leading-snug text-primary-shadow">{AMANDA.credentialLine}</p>
              <p className="mt-0.5 font-semibold leading-snug text-muted">{METHOD_LEAD.role}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-6">
          <figure className="rounded-[1.5rem] border-2 border-dashed border-primary-tint bg-white p-6 md:p-7">
            <figcaption>
              <span className="text-xs font-extrabold text-primary-shadow">From the scenario spec</span>
              <span className="mt-1 block font-display text-xl font-bold text-ink">
                Josh Brooks, revenue cycle analyst
              </span>
              <span className="mt-1 block font-semibold leading-snug text-muted">
                Four years in. His month-end reports have been late three months running.
              </span>
            </figcaption>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 font-display font-bold text-[color:var(--move-inconsistent-ink)]">
                  <span aria-hidden className="block size-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[color:var(--move-inconsistent)]" />
                  Shuts him down
                </p>
                <ul className="mt-3 space-y-2.5">
                  {spec.shuts.map((s) => (
                    <li key={s} className="font-semibold leading-snug text-ink">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-2 font-display font-bold text-[color:var(--move-reflection-ink)]">
                  <span aria-hidden className="block size-2.5 rotate-45 bg-[color:var(--move-reflection)]" />
                  Opens him up
                </p>
                <ul className="mt-3 space-y-2.5">
                  {spec.opens.map((s) => (
                    <li key={s} className="font-semibold leading-snug text-ink">{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-6 border-t-2 border-soft pt-4 font-semibold text-muted">
              <Link
                href="/scenarios"
                className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Browse all {scenarioCount} role-play scenarios
              </Link>
            </p>
          </figure>
        </Reveal>

        <Reveal className="lg:col-span-12">
          <p className="max-w-[60ch] border-t-2 border-line pt-8 text-lg font-semibold leading-relaxed text-ink/80">
            Amanda and Blake wrote down why they built it.{" "}
            <Link
              href="/about"
              className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Read why we built this
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
