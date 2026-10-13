import { getScenario } from "@antelope/core";
import { Scenarios } from "@/components/marketing/scenarios";
import { Reveal } from "@/components/reveal";
import { leaders } from "@/lib/audiences";
import { CoachNote, h2Class, TheirLine, YourLine } from "./parts";

// CR-012 in packages/core/src/scenarios.ts. Kevin's first line is his opening line; his
// second is built from his voice notes ("I'm not against it, but...", "Mrs. Alvarez can
// barely see her phone"). The notes paraphrase a sustain trigger and his change triggers.
const kevin = getScenario("CR-012");

function KevinScene() {
  if (!kevin) return null;
  return (
    <section aria-labelledby="scene-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-14">
        <Reveal className="lg:col-span-5">
          <h2 id="scene-heading" className={`max-w-[16ch] ${h2Class}`}>
            The third time you explain the kiosks
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-ink/80">
            Self-check-in kiosks go into every urgent care site next month. Kevin
            has run the front desk at your busiest one for eleven years, and his
            team knows he thinks it&apos;s a bad idea. You&apos;ve explained the
            plan twice. You ask him in to explain it again.
          </p>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-ink/80">
            In the role-play you can run it as many times as you like before you
            have it with a real front desk lead.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-7">
          <figure className="rounded-[1.75rem] border-2 border-line bg-white p-5 shadow-[0_6px_0_var(--shadow)] md:p-7">
            <figcaption className="flex items-baseline justify-between gap-3 border-b-2 border-soft pb-3">
              <span className="font-display text-lg font-bold text-ink">
                {kevin.persona.name}
                <span className="block text-sm font-semibold text-muted">{kevin.persona.role}</span>
              </span>
              <span className="text-sm font-extrabold text-primary-shadow">{kevin.title}</span>
            </figcaption>
            <div className="mt-5 space-y-3">
              <TheirLine who="Kevin" initials="KT">{kevin.openingLine}</TheirLine>
              <YourLine>Every site is getting them, and they&apos;ll cut wait times.</YourLine>
              <TheirLine who="Kevin" initials="KT">
                I&apos;m not against it, but Mrs. Alvarez can barely see her phone.
              </TheirLine>
              <CoachNote tone="shuts">
                Selling the benefits keeps Kevin defending his patients. He agrees to the
                training and offers nothing else.
              </CoachNote>
            </div>
            <div className="mt-6 space-y-3 border-t-2 border-dashed border-primary-tint pt-5">
              <p className="text-sm font-extrabold text-primary-shadow">Run it again</p>
              <YourLine>
                You know these patients better than anyone. What would it take for the kiosks
                to work for someone like Mrs. Alvarez?
              </YourLine>
              <CoachNote tone="opens">
                Ask for his expertise and Kevin starts solving it out loud: a kiosk helper, and
                one counter lane kept open.
              </CoachNote>
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

const path = [
  { weeks: "Weeks 1 and 2", body: "Short lessons and drills on OARS and the spirit of MI." },
  { weeks: `Week ${leaders.firstRoleplayWeek}`, body: "Your first role-play: a check-in with Lucia, who has gone quiet." },
  { weeks: "Weeks 4 to 9", body: "Josh's late reports, Angela doing everything herself, and Kevin's kiosks. Week 9 has you code your own transcript." },
  { weeks: "Week 10", body: "Holding a clear standard while leaving the how to them." },
  { weeks: "Weeks 11 and 12", body: "Tom, the night charge nurse who found out from a memo." },
];

function LeadersPath() {
  return (
    <section aria-labelledby="path-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <h2 id="path-heading" className={h2Class}>
            The {leaders.weeks}-week path
          </h2>
          <p className="mt-4 max-w-[40ch] text-lg font-semibold leading-relaxed text-ink/80">
            A week takes {leaders.min} to {leaders.max} minutes, and you can split it
            across days. If your organization runs a cohort, a trainer assigns the weeks
            with due dates and reads the role-plays you choose to send.
          </p>
        </Reveal>
        <Reveal delay={0.06} className="lg:col-span-7">
          <dl className="divide-y-2 divide-line border-y-2 border-line">
            {path.map((p) => (
              <div key={p.weeks} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-display text-lg font-bold text-primary-shadow">{p.weeks}</dt>
                <dd className="text-lg font-semibold leading-snug text-ink">{p.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

export function LeadersSections() {
  return (
    <>
      <KevinScene />
      <Scenarios
        setting="workplace"
        exclude={["CR-012"]}
        heading="And the other four"
        body="All fictional, each with a backstory you have to draw out. This is how each of them opens."
      />
      <LeadersPath />
    </>
  );
}
