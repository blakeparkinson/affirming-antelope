import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachNote } from "@/components/audience/parts";
import { DownloadBand } from "@/components/download-band";
import { CtaNote, GetTheApp } from "@/components/get-the-app";
import { GuideCard } from "@/components/guides/guide-card";
import { Reveal } from "@/components/reveal";
import { DifficultyPips, PersonaDisc } from "@/components/scenarios/bits";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCES } from "@/lib/audiences";
import { breadcrumbLd, JsonLd, learningResourceLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  difficultyLabel,
  getAllScenarios,
  getPublicScenario,
  guidesForScenario,
  scenarioAudienceType,
  scenarioDescription,
  seoFor,
  skillName,
  skillTagline,
} from "@/lib/scenarios";
import { roleplayHref } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllScenarios().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/scenarios/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = getPublicScenario(id);
  if (!s) return {};
  const seo = seoFor(s);
  return pageMetadata({
    title: seo.title,
    absoluteTitle: true,
    description: scenarioDescription(s),
    path: `/scenarios/${s.id}`,
    keywords: [
      "motivational interviewing role play",
      seo.h1.replace(/^Practice talking to /, "talking to ").toLowerCase(),
      `motivational interviewing ${s.issue.toLowerCase()}`,
    ],
  });
}

const linkClass =
  "font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default async function ScenarioPage({ params }: PageProps<"/scenarios/[id]">) {
  const { id } = await params;
  const s = getPublicScenario(id);
  if (!s) notFound();

  const seo = seoFor(s);
  const path = `/scenarios/${s.id}`;
  const location = `scenario_${s.id}`;
  const clinical = s.setting === "clinical";
  const audience = AUDIENCES[clinical ? "clinicians" : "leaders"];
  const href = roleplayHref(s.id);
  const guides = guidesForScenario(s);
  const easier = s.easierId ? getPublicScenario(s.easierId) : undefined;
  const harder = s.harderId ? getPublicScenario(s.harderId) : undefined;
  const draftNote = AUDIENCES.clinicians.faq.find((f) => f.q.startsWith("Has the clinical content"));
  const primary = s.primaryChallenge;
  const skills = [primary, ...s.targetSkills.filter((k) => k !== primary)];

  return (
    <>
      <JsonLd
        data={[
          learningResourceLd({
            name: seo.h1,
            description: scenarioDescription(s),
            path,
            difficulty: difficultyLabel[s.difficulty],
            teaches: skills.map(skillName),
            audienceType: scenarioAudienceType(s),
          }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Scenarios", path: "/scenarios" },
            { name: seo.h1, path },
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
                  <Link href="/" className="hover:text-ink">
                    Home
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link href="/scenarios" className="hover:text-ink">
                    Scenarios
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink">
                  {s.persona.name}
                </li>
              </ol>
            </nav>

            <div className="mt-8 grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <p className="inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold text-primary-shadow shadow-[0_3px_0_var(--shadow)]">
                  {s.context}
                </p>
                <h1 className="mt-4 max-w-[20ch] pb-1 font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink md:text-5xl">
                  {seo.h1}
                </h1>
                <p className="mt-4 max-w-[52ch] text-lg font-semibold leading-snug text-ink/80 md:text-xl">
                  A free motivational interviewing role-play. You talk with {s.persona.name}, played by an AI that stays in
                  character, then get feedback on the moves you made.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <GetTheApp location={location} audience={audience.slug} size="lg" href={href}>
                    Try this role-play
                  </GetTheApp>
                  <DifficultyPips value={s.difficulty} />
                </div>
                <CtaNote className="mt-4" />
              </div>

              <figure className="lg:col-span-5">
                <div className="rounded-[1.5rem] border-2 border-line bg-white p-5 shadow-[0_6px_0_var(--shadow)] md:p-6">
                  <div className="flex items-center gap-4">
                    <PersonaDisc name={s.persona.name} size="lg" />
                    <figcaption className="min-w-0">
                      <span className="block font-display text-xl font-bold leading-tight text-ink">
                        {s.persona.name}
                      </span>
                      <span className="mt-0.5 block font-semibold leading-snug text-muted">{s.persona.role}</span>
                      <span className="block text-sm font-bold text-muted">{s.persona.tenure}</span>
                    </figcaption>
                  </div>
                  <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                    How {s.persona.name.split(" ")[0]} opens
                  </p>
                  <blockquote className="mt-2 rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 font-display text-xl font-semibold leading-snug text-ink">
                    “{s.openingLine}”
                  </blockquote>
                </div>
              </figure>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-12">
          <div className="min-w-0 space-y-12 lg:col-span-8">
            <section aria-labelledby="brief-heading">
              <h2 id="brief-heading" className="font-display text-3xl font-bold tracking-tight text-ink">
                Your brief
              </h2>
              <p className="mt-4 max-w-[62ch] text-lg font-semibold leading-relaxed text-ink/90">{s.learnerBrief}</p>
              <p className="mt-5 max-w-[62ch] rounded-[1.25rem] border-2 border-dashed border-primary-tint bg-white px-5 py-4 text-lg font-semibold leading-snug text-ink">
                <span className="block text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                  Your goal
                </span>
                {s.learnerGoal}
              </p>
            </section>

            <Reveal>
              <div className="grid gap-8 rounded-[1.5rem] border-2 border-line bg-white p-6 shadow-[0_5px_0_var(--shadow)] md:grid-cols-2 md:p-8">
                <section aria-labelledby="shuts-heading">
                  <h2 id="shuts-heading" className="font-display text-xl font-bold text-ink">
                    What tends to shut them down
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {s.sustainTriggers.map((t) => (
                      <li key={t}>
                        <CoachNote tone="shuts">{t}</CoachNote>
                      </li>
                    ))}
                  </ul>
                </section>
                <section aria-labelledby="opens-heading">
                  <h2 id="opens-heading" className="font-display text-xl font-bold text-ink">
                    What tends to open them up
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {s.changeTriggers.map((t) => (
                      <li key={t}>
                        <CoachNote tone="opens">{t}</CoachNote>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <p className="mt-4 text-sm font-bold text-muted">
                {s.persona.name.split(" ")[0]} also has a backstory you won&apos;t see here. In the role-play, you
                draw it out.
              </p>
            </Reveal>
          </div>

          <aside className="space-y-8 lg:col-span-4" aria-label="About this scenario">
            <section aria-labelledby="skills-heading">
              <h2 id="skills-heading" className="font-display text-xl font-bold text-ink">
                Skills you&apos;ll practice
              </h2>
              <ul className="mt-4 divide-y-2 divide-soft rounded-[1.25rem] border-2 border-line bg-white">
                {skills.map((k) => (
                  <li key={k} className="px-4 py-3">
                    <p className="font-display font-bold text-ink">
                      {skillName(k)}
                      {k === primary && (
                        <span className="ml-2 rounded-lg bg-gold-tint px-2 py-0.5 align-middle font-sans text-xs font-extrabold text-gold-ink">
                          Main focus
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-muted">{skillTagline(k)}</p>
                  </li>
                ))}
              </ul>
            </section>

            {(easier || harder) && (
              <section aria-labelledby="levels-heading">
                <h2 id="levels-heading" className="font-display text-xl font-bold text-ink">
                  Change the difficulty
                </h2>
                <ul className="mt-4 space-y-3">
                  {easier && (
                    <li>
                      <Link
                        href={`/scenarios/${easier.id}`}
                        className="block rounded-[1.25rem] border-2 border-line bg-white p-4 shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                          Easier
                        </span>
                        <span className="mt-1 block font-bold leading-snug text-ink">{seoFor(easier).h1}</span>
                        <DifficultyPips value={easier.difficulty} className="mt-2" />
                      </Link>
                    </li>
                  )}
                  {harder && (
                    <li>
                      <Link
                        href={`/scenarios/${harder.id}`}
                        className="block rounded-[1.25rem] border-2 border-line bg-white p-4 shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                          Harder
                        </span>
                        <span className="mt-1 block font-bold leading-snug text-ink">{seoFor(harder).h1}</span>
                        <DifficultyPips value={harder.difficulty} className="mt-2" />
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            )}

            <p className="font-semibold text-muted">
              <Link href="/scenarios" className={linkClass}>
                All role-play scenarios
              </Link>
              <br />
              <Link href={`/for/${audience.slug}`} className={`${linkClass} mt-2 inline-block`}>
                {audience.linkLabel}
              </Link>
            </p>
          </aside>
        </div>

        {clinical && draftNote && (
          <div className="mx-auto max-w-6xl px-5 pb-12 md:px-8 md:pb-16">
            <aside
              aria-labelledby="draft-heading"
              className="max-w-[68ch] rounded-[1.25rem] border-2 border-gold bg-gold-tint px-5 py-4"
            >
              <h2 id="draft-heading" className="font-display text-lg font-bold text-gold-ink">
                About the clinical content
              </h2>
              <p className="mt-1 font-semibold leading-snug text-ink">
                {draftNote.a}{" "}
                <Link href="/for/clinicians" className={linkClass}>
                  More on MI for clinicians
                </Link>
              </p>
            </aside>
          </div>
        )}

        {guides.length > 0 && (
          <section className="border-t-2 border-line bg-soft" aria-labelledby="guides-heading">
            <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-16">
              <h2 id="guides-heading" className="font-display text-3xl font-bold tracking-tight text-ink">
                Read first
              </h2>
              <p className="mt-2 max-w-[52ch] font-semibold text-muted">
                Guides on the skills this role-play asks for.
              </p>
              <ul className="mt-8 grid gap-4 md:grid-cols-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <DownloadBand
          location={location}
          audience={audience.slug}
          appLink={href}
          appLabel="Try this role-play"
          mascot
          heading={`Talk with ${s.persona.name.split(" ")[0]} yourself`}
          body="The role-play opens in your browser. Type your replies or say them out loud, and finish with feedback on the moves you made."
        />
      </main>
      <SiteFooter />
    </>
  );
}
