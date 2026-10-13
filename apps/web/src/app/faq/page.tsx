import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { HOME_FAQ } from "@/lib/home-faq";
import { breadcrumbLd, faqPageLd, JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { pilotLink, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Questions about Affirming Antelope",
  description:
    "Answers about privacy, cost, MI training, and running a cohort with Affirming Antelope, motivational interviewing practice for leaders and clinicians.",
  path: "/faq",
  keywords: ["Affirming Antelope FAQ", "motivational interviewing practice questions"],
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          faqPageLd(HOME_FAQ, `${SITE_URL}/faq`),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ]}
      />
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <Faq
          items={HOME_FAQ}
          heading="Questions people ask"
          aside={
            <p className="mt-4 max-w-[34ch] font-semibold leading-relaxed text-muted">
              Leading a training?{" "}
              <a
                {...pilotLink("faq")}
                className="whitespace-nowrap font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Book a 30-minute call
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </p>
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
