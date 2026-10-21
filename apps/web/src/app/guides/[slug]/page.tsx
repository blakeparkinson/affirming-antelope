import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import rehypeSlug from "rehype-slug";
import { CtaNote, GetTheApp } from "@/components/get-the-app";
import { audienceLabel, GuideCard } from "@/components/guides/guide-card";
import { guideComponents, TryDrill } from "@/components/guides/mdx-components";
import { Toc } from "@/components/guides/toc";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { getAudience } from "@/lib/audiences";
import { formatDate, getAllGuides, getGuide, getHeadings, getRelatedGuides } from "@/lib/guides";
import { getPerson } from "@/lib/people";
import { articleLd, breadcrumbLd, faqPageLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  // Drafts get a (noindexed) page so writers can preview them.
  return getAllGuides({ includeDrafts: true }).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.title,
    absoluteTitle: true,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    type: "article",
    keywords: guide.keywords,
    modifiedTime: guide.updated,
    noindex: guide.draft,
  });
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  const headings = getHeadings(guide.body);
  const tocItems = guide.faq.length
    ? [...headings, { depth: 2 as const, text: "Questions people ask", id: "faq" }]
    : headings;
  const related = getRelatedGuides(guide);
  const hasInlineMainDrill = guide.drillId
    ? new RegExp(`<TryDrill[^>]*id=["']${guide.drillId}["']`).test(guide.body)
    : true;
  const location = `guide_${guide.slug}`;
  const audience = guide.audience !== "all" ? getAudience(guide.audience) : undefined;
  const reviewer = guide.reviewedBy ? getPerson(guide.reviewedBy) : undefined;

  const ld = [
    articleLd({
      title: guide.title,
      description: guide.description,
      path,
      updated: guide.updated,
      keywords: guide.keywords,
      reviewer,
    }),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: guide.title, path },
    ]),
    ...(guide.faq.length ? [faqPageLd(guide.faq, `${SITE_URL}${path}`)] : []),
  ];

  return (
    <>
      <JsonLd data={ld} />
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
                  <Link href="/guides" className="-my-3 inline-block py-3 hover:text-ink">
                    Guides
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="max-w-[28ch] truncate text-ink">
                  {guide.title}
                </li>
              </ol>
            </nav>
            <div className="mt-8 grid items-end gap-8 md:grid-cols-12">
              <div className="md:col-span-9">
                <p className="inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-extrabold text-primary-shadow shadow-[0_3px_0_var(--shadow)]">
                  {audienceLabel[guide.audience]}
                </p>
                <h1 className="mt-4 max-w-[22ch] pb-1 font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink md:text-5xl">
                  {guide.title}
                </h1>
                <p className="mt-4 max-w-[58ch] text-lg font-semibold leading-snug text-ink/80 md:text-xl">
                  {guide.description}
                </p>
                <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-extrabold text-ink/80">
                  <span>
                    Updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
                  </span>
                  <span aria-hidden>·</span>
                  <span>{guide.readingMinutes} min read</span>
                  {reviewer && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        Reviewed by{" "}
                        {reviewer.page ? (
                          <Link
                            href={reviewer.page}
                            className="underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                          >
                            {reviewer.displayName}
                          </Link>
                        ) : (
                          reviewer.displayName
                        )}
                        {guide.reviewedOn && (
                          <>
                            {" "}
                            on <time dateTime={guide.reviewedOn}>{formatDate(guide.reviewedOn)}</time>
                          </>
                        )}
                      </span>
                    </>
                  )}
                  {guide.draft && (
                    <span className="rounded-lg bg-gold-tint px-2 py-0.5 text-gold-ink">Draft, not indexed</span>
                  )}
                </p>
              </div>
              <div className="hidden justify-end md:col-span-3 md:flex">
                <Image
                  src="/brand-mascot-wave-cartoon-deep.png"
                  alt=""
                  width={674}
                  height={978}
                  sizes="120px"
                  preload
                  className="h-44 w-auto"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-12">
          <aside className="lg:order-2 lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <details className="group rounded-[1.25rem] border-2 border-line bg-white p-4 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                  On this page
                  <CaretDown size={16} weight="bold" aria-hidden className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 [&_#toc-heading]:sr-only">
                  <Toc headings={tocItems} />
                </div>
              </details>
              <div className="hidden lg:block">
                <Toc headings={tocItems} />
                <div className="mt-8 rounded-[1.25rem] border-2 border-line bg-soft p-4">
                  <p className="font-display font-bold text-ink">Practice it, free</p>
                  <p className="mt-1 text-sm font-semibold text-ink/80">Five-minute drills in your browser.</p>
                  <GetTheApp location={location} size="sm" className="mt-3">
                    Start practicing
                  </GetTheApp>
                </div>
              </div>
            </div>
          </aside>

          <article className="min-w-0 lg:order-1 lg:col-span-8">
            <div className="max-w-[68ch] text-[1.09rem] font-semibold leading-[1.75] text-ink/90">
              <MDXRemote
                source={guide.body}
                components={guideComponents(guide.slug)}
                options={{ mdxOptions: { rehypePlugins: [rehypeSlug] } }}
              />
              {!hasInlineMainDrill && guide.drillId && (
                <TryDrill id={guide.drillId} slug={guide.slug} label="Try it now" />
              )}
            </div>

            {guide.faq.length > 0 && (
              <div className="mt-16 max-w-[68ch]">
                <Faq items={guide.faq} />
              </div>
            )}

            <section
              aria-labelledby="guide-cta-heading"
              className="mt-16 max-w-[68ch] rounded-[2rem] border-2 border-line bg-white p-6 shadow-[0_6px_0_var(--shadow)] md:p-8"
            >
              <div className="flex items-start gap-5">
                <Image
                  src="/brand-mascot-celebrate-cartoon-deep.png"
                  alt=""
                  width={703}
                  height={914}
                  sizes="80px"
                  className="hidden h-28 w-auto sm:block"
                />
                <div>
                  <h2 id="guide-cta-heading" className="font-display text-2xl font-bold text-ink md:text-3xl">
                    Reading it is step one.
                  </h2>
                  <p className="mt-2 max-w-[44ch] font-semibold text-muted">
                    The skill shows up when you practice it out loud. Try a five-minute drill or a role-play with
                    someone who isn&apos;t ready to change yet.
                  </p>
                  <div className="mt-5">
                    <GetTheApp location={location} audience={audience?.slug} size="lg" />
                  </div>
                  <CtaNote className="mt-3" />
                </div>
              </div>
            </section>
          </article>
        </div>

        {related.length > 0 && (
          <section className="border-t-2 border-line bg-soft" aria-labelledby="related-heading">
            <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
              <h2 id="related-heading" className="font-display text-3xl font-bold tracking-tight text-ink">
                Related guides
              </h2>
              <ul className="mt-8 grid gap-4 md:grid-cols-3">
                {related.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
