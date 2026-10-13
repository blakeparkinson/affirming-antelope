import Link from "next/link";
import type { ReactNode } from "react";
import { MI_FOR_CLINICIANS } from "@antelope/core";
import { PRICING_LINE } from "@/lib/site";
import { CtaNote, GetTheApp, PilotCta, TrainerCta } from "./get-the-app";
import { Reveal } from "./reveal";
import { Mascot } from "./mascot";
import { StreakCard } from "./streak-card";

type DownloadBandProps = {
  /** CTA location, e.g. `download_band` on home or `audience_leaders` on an audience page. */
  location?: string;
  audience?: "clinicians" | "leaders" | "trainers";
  heading?: string;
  body?: string;
  /** Trainers: lead with the pilot call, then the dashboard. */
  trainer?: boolean;
  /** CTA location for the pilot call (trainers), e.g. `trainers_closing`. */
  pilotLocation?: string;
  /** Home page only: a quiet pointer to the clinician pathway. */
  alsoClinicians?: boolean;
  /** Home page: offer the pilot call beside the app CTA, with the pricing line. */
  pilot?: boolean;
  /** Show the waving, animated antelope instead of the streak card. */
  mascot?: boolean;
  /** The mascot's speech bubble; pass null for none. */
  mascotLine?: string | null;
  /** Replaces the streak card with something from the page. */
  aside?: ReactNode;
  /** A deep link into the app for the primary CTA, instead of its home screen. */
  appLink?: string;
  /** Label for the app button (defaults to "Start practicing free"). */
  appLabel?: string;
};

export function DownloadBand({
  location = "download_band",
  audience,
  heading = "Start a streak today.",
  body = "Open it in your browser, on your phone or your laptop. No download, no card. Your first drill, a one-on-one with an employee, takes five minutes.",
  trainer = false,
  pilotLocation,
  alsoClinicians = false,
  pilot = false,
  mascot = false,
  mascotLine = "Ready when you are.",
  aside,
  appLink,
  appLabel,
}: DownloadBandProps) {
  return (
    <section
      id="start"
      className="scroll-mt-16 border-t-2 border-line bg-soft"
      aria-labelledby={`start-heading-${location}`}
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid items-center gap-8 rounded-[2rem] border-2 border-line bg-white px-6 py-8 shadow-[0_6px_0_var(--shadow)] md:grid-cols-12 md:px-10 md:py-10">
          <Reveal className="md:col-span-7">
            <h2
              id={`start-heading-${location}`}
              className="max-w-[20ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
            >
              {heading}
            </h2>
            <p className="mt-3 max-w-[40ch] text-lg font-semibold text-muted">{body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              {trainer ? (
                <>
                  <PilotCta location={pilotLocation ?? location} size="lg" />
                  <TrainerCta location={location} size="lg" />
                </>
              ) : (
                <>
                  <GetTheApp location={location} audience={audience} size="lg" href={appLink}>
                    {appLabel ?? "Start practicing free"}
                  </GetTheApp>
                  {pilot && <PilotCta location={location} size="lg" variant="secondary" />}
                </>
              )}
            </div>
            {!trainer && !pilot && <CtaNote className="mt-4" />}
            {pilot && <p className="mt-4 text-sm font-bold text-muted">{PRICING_LINE}</p>}
            {!trainer && !pilot && (
              <p className="mt-6 border-t-2 border-soft pt-5 font-semibold text-muted">
                Leading a training?{" "}
                <Link
                  href="/for/trainers"
                  className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  See how trainer review works
                </Link>
              </p>
            )}
            {!trainer && alsoClinicians && (
              <p className={`font-semibold text-muted ${pilot ? "mt-6 border-t-2 border-soft pt-5" : "mt-3"}`}>
                <Link
                  href="/for/clinicians"
                  className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  MI for clinicians
                </Link>{" "}
                has its own {MI_FOR_CLINICIANS.units.length}-week pathway for patient visits.
              </p>
            )}
          </Reveal>
          <div className="md:col-span-5">
            {aside ? (
              aside
            ) : mascot ? (
              <div className="relative mx-auto flex max-w-sm flex-col items-center">
                {mascotLine && (
                  <p className="relative z-10 self-start rounded-2xl border-2 border-line bg-white px-4 py-2.5 font-extrabold text-ink shadow-[0_4px_0_var(--shadow)]">
                    {mascotLine}
                  </p>
                )}
                <Mascot
                  alt="Affirming Antelope waving hello"
                  width={674}
                  height={978}
                  whenVisible
                  sizes="(min-width: 768px) 260px, 220px"
                  className="mx-auto -mt-2 h-[17rem] w-auto max-w-full md:h-[20rem]"
                />
              </div>
            ) : (
              <StreakCard />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
