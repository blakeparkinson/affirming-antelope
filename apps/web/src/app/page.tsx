import type { Metadata } from "next";
import { DownloadBand } from "@/components/download-band";
import { HowItWorks } from "@/components/home/how-it-works";
import { Hero } from "@/components/home/hero";
import { Method } from "@/components/home/method";
import { WhoItsFor } from "@/components/home/who-its-for";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCES } from "@/lib/audiences";
import { JsonLd, organizationLd, softwareApplicationLd, websiteLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

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
        ]}
      />
      <SiteNav />
      <main>
        <Hero />
        <Method />
        <WhoItsFor />
        <HowItWorks />
        <DownloadBand
          heading="How to start"
          body="Pick your path, do a five-minute drill, then try a ten-minute role-play. It runs in the browser on your phone or laptop, with no download and no card."
          mascot
        />
      </main>
      <SiteFooter />
    </div>
  );
}
