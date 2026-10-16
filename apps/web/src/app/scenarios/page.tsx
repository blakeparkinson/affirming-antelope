import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DownloadBand } from "@/components/download-band";
import { Reveal } from "@/components/reveal";
import { DifficultyPips, PersonaDisc } from "@/components/scenarios/bits";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { breadcrumbLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getAllScenarios, scenarioGroups, scenariosByDifficulty, seoFor } from "@/lib/scenarios";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Motivational interviewing role-play scenarios",
  absoluteTitle: true,
  description:
    "Fictional role-play scenarios for motivational interviewing practice: team conversations for healthcare leaders and patient visits for clinicians, easy to hard.",
  path: "/scenarios",
  keywords: [
    "motivational interviewing role play",
    "motivational interviewing scenarios",
    "motivational interviewing practice scenarios",
    "difficult conversations role play healthcare",
  ],
});

const linkClass =
  "font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function ScenariosIndex() {
  const all = getAllScenarios();

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Motivational interviewing role-play scenarios",
      url: `${SITE_URL}/scenarios`,
      inLanguage: "en",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: scenarioGroups
          .flatMap((g) => scenariosByDifficulty(g.setting))
          .map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/scenarios/${s.id}`,
            name: seoFor(s).h1,
          })),
      },
    },
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Scenarios", path: "/scenarios" },
    ]),
  ];

  return (
    <>
      <JsonLd data={ld} />
      <SiteNav />
      <main>
        <header className="border-b-2 border-line bg-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-12 md:px-8 md:py-16">
            <div className="md:col-span-8">
              <p className="mb-4 inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold text-primary-shadow shadow-[0_3px_0_var(--shadow)]">
                Role-play scenarios
              </p>
              <h1 className="max-w-[18ch] pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl">
                Pick the conversation you want to rehearse.
              </h1>
              <p className="mt-5 max-w-[52ch] text-lg font-semibold leading-snug text-ink/80">
                {all.length} fictional people, each with a reason you have to draw out. Read how they open, then try the
                role-play in your browser. Most link to an easier or harder version.
              </p>
            </div>
            <div className="hidden justify-end md:col-span-4 md:flex">
              <Image
                src="/brand-mascot-wave-cartoon-deep.png"
                alt=""
                width={674}
                height={978}
                sizes="150px"
                preload
                className="h-56 w-auto"
              />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-16 px-5 py-14 md:px-8 md:py-20">
          {scenarioGroups.map((group) => (
            <section key={group.setting} aria-labelledby={`group-${group.setting}`}>
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
                <div>
                  <h2 id={`group-${group.setting}`} className="font-display text-3xl font-bold tracking-tight text-ink">
                    {group.heading}
                  </h2>
                  <p className="mt-2 max-w-[52ch] font-semibold text-muted">{group.blurb}</p>
                </div>
                <Link href={group.audiencePath} className={linkClass}>
                  {group.setting === "workplace" ? "MI for healthcare leaders" : "MI for clinicians"}
                </Link>
              </div>
              <ul className="mt-8 grid gap-5 md:grid-cols-2">
                {scenariosByDifficulty(group.setting).map((s, i) => (
                  <li key={s.id}>
                    <Reveal delay={0.04 * (i % 2)} className="h-full">
                      <Link
                        href={`/scenarios/${s.id}`}
                        className="group flex h-full flex-col rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)] transition-[transform,box-shadow,border-color] duration-100 ease-out hover:-translate-y-0.5 hover:border-primary-tint hover:shadow-[0_7px_0_var(--shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                            {s.context}
                          </span>
                          <DifficultyPips value={s.difficulty} />
                        </span>
                        <span className="mt-4 rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 text-lg font-bold leading-snug text-ink">
                          “{s.openingLine}”
                        </span>
                        <span className="mt-4 flex items-center gap-3">
                          <PersonaDisc name={s.persona.name} />
                          <span className="min-w-0">
                            <span className="block font-display text-lg font-bold leading-tight text-ink">
                              {s.persona.name}
                            </span>
                            <span className="block text-sm font-semibold leading-snug text-muted">{s.persona.role}</span>
                          </span>
                        </span>
                        <span className="mt-4 border-t-2 border-soft pt-3 font-extrabold leading-snug text-ink group-hover:text-primary-shadow">
                          {seoFor(s).h1}
                        </span>
                      </Link>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DownloadBand
          location="scenarios"
          mascot
          heading="Start with the one that worries you most"
          body="Open any role-play in your browser, with no download and no card. Type your replies or say them out loud."
        />
      </main>
      <SiteFooter />
    </>
  );
}
