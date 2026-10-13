import { MI_FOR_LEADERS } from "@antelope/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PilotCta } from "@/components/get-the-app";
import { Reveal } from "@/components/reveal";
import { PersonaDisc } from "@/components/scenarios/bits";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { scenarioCount } from "@/lib/audiences";
import { AMANDA, BLAKE, WHY_WE_BUILT } from "@/lib/people";
import { breadcrumbLd, JsonLd, organizationLd, personLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About Affirming Antelope and the people behind it",
  absoluteTitle: true,
  description:
    "Affirming Antelope is motivational interviewing practice for healthcare leaders, designed by Amanda Roth, LCSW, and built by Blake Parkinson.",
  path: "/about",
  keywords: ["Affirming Antelope", "Amanda Roth LCSW", "motivational interviewing practice platform"],
});

const linkClass =
  "font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const h2Class = "font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl";

export default function AboutPage() {
  const weeks = MI_FOR_LEADERS.units.length;
  const why = WHY_WE_BUILT;
  const paragraphs = why.body.filter((p) => p.trim());

  return (
    <>
      <JsonLd
        data={[
          organizationLd(),
          personLd(BLAKE),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${SITE_NAME}`,
            url: `${SITE_URL}/about`,
            inLanguage: "en",
            about: { "@id": `${SITE_URL}/#organization` },
          },
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        ]}
      />
      <SiteNav />
      <main>
        <header className="border-b-2 border-line">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
            <p className="mb-4 inline-flex rounded-xl bg-soft px-3 py-1.5 text-sm font-extrabold text-primary-shadow">
              About
            </p>
            <h1 className="max-w-[18ch] pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl lg:text-[3.6rem]">
              About Affirming Antelope
            </h1>
            <p className="mt-5 max-w-[56ch] text-lg font-semibold leading-snug text-muted md:text-xl">
              Affirming Antelope is motivational interviewing (MI) practice for healthcare leaders. You rehearse a hard
              one-on-one with a simulated employee, then get feedback on the moves you made. Clinicians have their own pathway
              for patient visits.
            </p>
          </div>
        </header>

        <section aria-labelledby="people-heading" className="border-b-2 border-line bg-soft">
          <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <h2 id="people-heading" className={h2Class}>
              Who&apos;s behind it
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Reveal>
                <article className="flex h-full flex-col rounded-[1.5rem] border-2 border-line bg-white p-6 shadow-[0_5px_0_var(--shadow)] md:p-7">
                  <div className="flex items-center gap-5">
                    <Image
                      src={AMANDA.photo!.src}
                      alt={AMANDA.photo!.alt}
                      width={AMANDA.photo!.width}
                      height={AMANDA.photo!.height}
                      sizes="96px"
                      className="size-24 shrink-0 rounded-full border-4 border-white object-cover shadow-[0_4px_0_var(--shadow)]"
                    />
                    <div>
                      <h3 className="font-display text-2xl font-bold leading-tight text-ink">{AMANDA.displayName}</h3>
                      <p className="mt-1 text-sm font-extrabold leading-snug text-primary-shadow">{AMANDA.credentialLine}</p>
                      <p className="mt-1 font-semibold leading-snug text-muted">{AMANDA.jobTitle}</p>
                    </div>
                  </div>
                  <p className="mt-5 flex-1 text-lg font-semibold leading-relaxed text-ink/80">
                    Amanda designed the MI for Leaders program. The {weeks}-week path in the app follows it, and each
                    role-play is written to respond the way her learners&apos; employees do.
                  </p>
                  <p className="mt-4">
                    <Link href={AMANDA.page!} className={linkClass}>
                      More about Amanda
                    </Link>
                  </p>
                </article>
              </Reveal>
              <Reveal delay={0.06}>
                <article className="flex h-full flex-col rounded-[1.5rem] border-2 border-line bg-white p-6 shadow-[0_5px_0_var(--shadow)] md:p-7">
                  <div className="flex items-center gap-5">
                    <span className="grid size-24 shrink-0 place-items-center">
                      <PersonaDisc name={BLAKE.name} size="lg" />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-bold leading-tight text-ink">{BLAKE.displayName}</h3>
                      <p className="mt-1 font-semibold leading-snug text-muted">Builds Affirming Antelope</p>
                    </div>
                  </div>
                  <p className="mt-5 flex-1 text-lg font-semibold leading-relaxed text-ink/80">
                    Blake builds the app and this site. He turns Amanda&apos;s program into practice you can open
                    in a browser.
                  </p>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section aria-labelledby="how-heading">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-12 md:px-8 md:py-20">
            <h2 id="how-heading" className={`${h2Class} md:col-span-4`}>
              What it is and how the method works
            </h2>
            <div className="max-w-[62ch] space-y-5 text-lg font-semibold leading-relaxed text-ink/80 md:col-span-8">
              <p>
                Every role-play starts from a scenario spec. The spec says who the person is, what they care about,
                what they are holding back, what shuts them down, and what opens them up. An AI plays that person and
                stays in character, so Josh gets sharper when you lecture and slows down when you reflect what you
                hear.
              </p>
              <p>
                The AI is your practice partner. It plays the other person and names the MI moves you made, such as
                open questions, reflections, and affirmations. A trainer is the authority on what good looks like. In
                a cohort, the trainer assigns practice, reads the role-plays you choose to send, and coaches them.
              </p>
              <p>
                You can read the library before you start: all {scenarioCount} fictional people are on the{" "}
                <Link href="/scenarios" className={linkClass}>
                  scenarios page
                </Link>
                , and the{" "}
                <Link href="/guides" className={linkClass}>
                  guides
                </Link>{" "}
                explain each skill with example dialogue.
              </p>
            </div>
          </div>
        </section>

        {paragraphs.length > 0 && why.signedBy.trim() && (
          <section aria-labelledby="why-heading" className="border-t-2 border-line bg-soft">
            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-12 md:px-8 md:py-20">
              <h2 id="why-heading" className={`${h2Class} md:col-span-4`}>
                {why.heading}
              </h2>
              <div className="max-w-[62ch] md:col-span-8">
                {paragraphs.map((p) => (
                  <p key={p} className="mb-5 text-lg font-semibold leading-relaxed text-ink/80">
                    {p}
                  </p>
                ))}
                <p className="font-display text-lg font-bold text-ink">{why.signedBy}</p>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="contact-heading" className="border-t-2 border-line">
          <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <div className="rounded-[2rem] border-2 border-line bg-white px-6 py-8 shadow-[0_6px_0_var(--shadow)] md:px-10 md:py-10">
              <h2 id="contact-heading" className={h2Class}>
                Talk to us
              </h2>
              <p className="mt-3 max-w-[48ch] text-lg font-semibold text-muted">
                Planning a cohort, or want to see how it would work with your team? Book a call with Blake.
              </p>
              <div className="mt-7">
                <PilotCta location="about" size="lg" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
