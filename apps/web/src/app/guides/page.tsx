import type { Metadata } from "next";
import Image from "next/image";
import { DownloadBand } from "@/components/download-band";
import { GuideCard } from "@/components/guides/guide-card";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { getAllGuides, type GuideAudience } from "@/lib/guides";
import { breadcrumbLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Motivational interviewing guides and examples",
  description:
    "Plain-language guides to Motivational Interviewing: OARS, reflections, change talk, and sustain talk, with example dialogue and a drill to practice each one.",
  path: "/guides",
  keywords: ["motivational interviewing guide", "motivational interviewing examples", "OARS examples"],
});

const groups: { key: GuideAudience; heading: string }[] = [
  { key: "all", heading: "The core skills" },
  { key: "clinicians", heading: "For clinicians" },
  { key: "leaders", heading: "For leaders" },
  { key: "trainers", heading: "For trainers" },
];

export default function GuidesIndex() {
  const guides = getAllGuides();
  const filled = groups
    .map((g) => ({ ...g, guides: guides.filter((x) => x.audience === g.key) }))
    .filter((g) => g.guides.length);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/guides/${g.slug}`,
      name: g.title,
    })),
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/guides" },
          ]),
          ...(guides.length ? [itemList] : []),
        ]}
      />
      <SiteNav />
      <main>
        <header className="border-b-2 border-line bg-soft">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-12 md:px-8 md:py-16">
            <div className="md:col-span-8">
              <p className="mb-4 inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold text-primary-shadow shadow-[0_3px_0_var(--shadow)]">
                MI guides
              </p>
              <h1 className="max-w-[18ch] pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl">
                Motivational interviewing, one skill at a time.
              </h1>
              <p className="mt-5 max-w-[50ch] text-lg font-semibold leading-snug text-ink/80">
                What each skill is, what it sounds like in a real conversation, and a short drill so you can try it
                before your next one.
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

        <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          {filled.length === 0 ? (
            <p className="max-w-[44ch] text-lg font-semibold text-muted">
              The first guides are being written now. In the meantime, the drills in the app cover every skill.
            </p>
          ) : (
            <div className="space-y-16">
              {filled.map((group) => (
                <section key={group.key} aria-labelledby={`group-${group.key}`}>
                  <h2 id={`group-${group.key}`} className="font-display text-3xl font-bold tracking-tight text-ink">
                    {group.heading}
                  </h2>
                  <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.guides.map((g, i) => (
                      <li key={g.slug}>
                        <Reveal delay={0.04 * (i % 3)} className="h-full">
                          <GuideCard guide={g} />
                        </Reveal>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <DownloadBand
          location="guide_index"
          heading="Practice what you just read."
          body="Every guide links to a drill. Or open the app and start with today's."
        />
      </main>
      <SiteFooter />
    </>
  );
}
