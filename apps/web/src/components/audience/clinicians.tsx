import { getScenario, MI_FOR_CLINICIANS, scenariosForSetting } from "@antelope/core";
import { ReplayChart } from "@/components/home/how-it-works";
import { Scenarios } from "@/components/marketing/scenarios";
import { PathwayShowcase } from "@/components/marketing/showcase";
import { Reveal } from "@/components/reveal";
import { clinicians } from "@/lib/audiences";
import { h2Class } from "./parts";

// CL-105 in packages/core/src/scenarios-clinicians.ts: the brief and her opening line.
const joanne = getScenario("CL-105");

function JoanneScene() {
  if (!joanne) return null;
  return (
    <section aria-labelledby="scene-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2 id="scene-heading" className={h2Class}>
            She waited fifty minutes past her appointment
          </h2>
          <figure className="mt-8">
            <blockquote className="font-display text-2xl font-semibold leading-snug text-ink md:text-[2rem] md:leading-[1.2]">
              “{joanne.openingLine}”
            </blockquote>
            <figcaption className="mt-4 font-semibold text-ink/80">
              <span className="font-display font-bold text-ink">{joanne.persona.name}</span>,{" "}
              {joanne.persona.role.toLowerCase()}
            </figcaption>
          </figure>
        </Reveal>
        <Reveal delay={0.06} className="mt-10 grid gap-6 border-t-2 border-line pt-8 md:grid-cols-2 md:gap-10">
          <p className="text-lg font-semibold leading-relaxed text-ink/80">
            Joanne is here about a cough that has lasted a month. Her chart says a pack a
            day, and a note from two years ago reads &ldquo;counseled re: cessation, pt
            declined.&rdquo; You&apos;re seeing her for the first time.
          </p>
          <p className="text-lg font-semibold leading-relaxed text-ink/80">
            The fast move is to tell her to quit, and she has told you how that went
            last time. The role-play asks you to repair the visit first. If she&apos;s
            willing after that, you explore her own reasons.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Debrief() {
  return (
    <section aria-labelledby="debrief-heading" className="bg-primary text-primary-ink">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <h2
            id="debrief-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl"
          >
            What the debrief shows you
          </h2>
          <p className="mt-4 max-w-[42ch] text-lg font-semibold leading-relaxed text-[color:var(--on-primary-body)]">
            After a role-play you get a count of your open and closed questions and your
            simple and complex reflections. The chart traces how open the patient was after
            each reply, and the coach picks one thing to try next time.
          </p>
        </Reveal>
        <Reveal delay={0.06} className="lg:col-span-7">
          <div className="rounded-[1.5rem] bg-white p-4 text-ink shadow-[0_6px_0_var(--primary-shadow)] md:p-6 [&>figure]:mt-0">
            <ReplayChart who="patient" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CliniciansPathway() {
  return (
    <section aria-labelledby="pathway-heading">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
        <Reveal className="min-w-0">
          <h2 id="pathway-heading" className={`max-w-[18ch] ${h2Class}`}>
            {clinicians.weeks} weeks that fit a clinic day
          </h2>
          <p className="mt-3 max-w-[44ch] text-lg font-semibold text-ink/80">
            {MI_FOR_CLINICIANS.tagline} Each week has short lessons and drills, with a
            role-play from week {clinicians.firstRoleplayWeek} on. A week takes{" "}
            {clinicians.min} to {clinicians.max} minutes.
          </p>
        </Reveal>
        <div className="min-w-0">
          <PathwayShowcase
            title={MI_FOR_CLINICIANS.title}
            units={MI_FOR_CLINICIANS.units.slice(0, 5)}
            total={MI_FOR_CLINICIANS.units.length}
          />
        </div>
      </div>
    </section>
  );
}

export function CliniciansSections() {
  const count = scenariosForSetting("clinical").length - 2;
  return (
    <>
      <JoanneScene />
      <Debrief />
      <CliniciansPathway />
      <div className="border-t-2 border-line bg-soft">
        <Scenarios
          setting="clinical"
          exclude={["CL-105", "CL-102"]}
          heading={`${count === 3 ? "Three" : count} more patients on your schedule`}
          body="Every patient is fictional, with a history you won't see until you ask about it."
        />
      </div>
    </>
  );
}
