import type { Metadata } from "next";
import { DownloadBand } from "@/components/download-band";
import { HowItWorks } from "@/components/home/how-it-works";
import { Hero } from "@/components/home/hero";
import { Method } from "@/components/home/method";
import { PracticeSkills } from "@/components/home/practice-skills";
import { Problem } from "@/components/home/problem";
import { TrainerPilot } from "@/components/home/trainer-pilot";
import { Faq } from "@/components/marketing/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCES } from "@/lib/audiences";
import { HOME_FAQ } from "@/lib/home-faq";
import { faqPageLd, JsonLd, organizationLd, softwareApplicationLd, websiteLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { pilotLink, SITE_URL } from "@/lib/site";

const HOME_DESCRIPTION =
  "Free motivational interviewing practice for healthcare managers and team leads. Rehearse performance, change and burnout conversations with a simulated employee.";

export const metadata: Metadata = pageMetadata({
  title: "Motivational Interviewing Practice for Healthcare Leaders",
  absoluteTitle: true,
  description: HOME_DESCRIPTION,
  path: "/",
  keywords: [
    "motivational interviewing for healthcare leaders",
    "motivational interviewing for managers",
    "motivational interviewing practice",
    "motivational interviewing role play",
    "difficult conversations practice healthcare",
    "OARS motivational interviewing",
    "MI role play",
    "motivational interviewing training cohort",
  ],
});

export default function Home() {
  return (
    <div id="top">
      <JsonLd
        data={[
          organizationLd(),
          websiteLd(),
          softwareApplicationLd({ audience: AUDIENCES.leaders.audienceType }),
          faqPageLd(HOME_FAQ, SITE_URL),
        ]}
      />
      <SiteNav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <PracticeSkills />
        <TrainerPilot />
        <Method />
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <Faq
            items={HOME_FAQ}
            heading="Before you start"
            aside={
              <p className="mt-4 max-w-[34ch] font-semibold leading-relaxed text-muted">
                Planning a cohort?{" "}
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
        </div>
        <DownloadBand
          heading="Try it before your next one-on-one"
          body="It runs in the browser on your phone or laptop, with no download and no card. A drill takes about five minutes, a role-play about ten."
          alsoClinicians
          pilot
          mascot
        />
      </main>
      <SiteFooter />
    </div>
  );
}
