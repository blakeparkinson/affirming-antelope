import { DashboardMock } from "@/components/home/dashboard-mock";
import { Scenarios } from "@/components/marketing/scenarios";
import { Reveal } from "@/components/reveal";
import { drillCount, scenarioCount } from "@/lib/audiences";
import { h2Class } from "./parts";

const week = [
  {
    day: "Tuesday",
    body: "Session two ends with partner practice: two rounds of reflections before next week. Everyone writes it down.",
  },
  {
    day: "Friday",
    body: "One learner emails to ask whether a phone call with her sister counts.",
  },
  {
    day: "The next Tuesday",
    body: "You ask who practiced. Four hands go up. You never heard what anyone said, so you coach the room on a guess.",
  },
];

function TrainerWeek() {
  return (
    <section aria-labelledby="week-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2 id="week-heading" className={h2Class}>
            You assigned partner practice on Tuesday
          </h2>
        </Reveal>
        <ol className="mt-10 border-l-2 border-primary-tint">
          {week.map((w, i) => (
            <li key={w.day} className="relative pb-8 pl-7 last:pb-0">
              <span aria-hidden className="absolute top-2 -left-[7px] size-3 rounded-full bg-primary" />
              <Reveal delay={0.05 * i}>
                <p className="font-display text-lg font-bold text-primary-shadow">{w.day}</p>
                <p className="mt-1 text-lg font-semibold leading-relaxed text-ink">{w.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <Reveal>
          <p className="mt-10 rounded-[1.25rem] bg-white px-5 py-4 text-lg font-semibold leading-relaxed text-ink shadow-[0_4px_0_var(--shadow)]">
            With a cohort here, you&apos;d know by Friday. Jordan has finished three of seven
            and sent you a role-play with a question about the time-blocking moment.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const notes = [
  { label: "Their note", body: "Learners say where they got stuck when they send a session, so you know where to look." },
  { label: "The chart", body: "Where Josh moved toward change and where he dug in, with the key moments ringed." },
  {
    label: "Your reply",
    body: "Write it or record a voice note, give a level in words from Emerging to Strong, and ask for another try if you want one.",
  },
  { label: "The cohort", body: "Assigned and completed work for each person, and when they were last active." },
];

function AnnotatedDashboard() {
  return (
    <section aria-labelledby="dash-heading">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:items-start lg:gap-14">
        <div className="lg:col-span-7 lg:pb-12">
          <DashboardMock />
        </div>
        <Reveal className="lg:col-span-5">
          <h2 id="dash-heading" className={h2Class}>
            What Jordan sent you
          </h2>
          <dl className="mt-6 space-y-5">
            {notes.map((n) => (
              <div key={n.label}>
                <dt className="font-display text-lg font-bold text-ink">{n.label}</dt>
                <dd className="mt-0.5 font-semibold leading-snug text-muted">{n.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function CohortSetup() {
  return (
    <section aria-labelledby="setup-heading" className="bg-navy text-white">
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <h2
            id="setup-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl"
          >
            Setting up a cohort
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-[color:var(--on-primary-muted)]">
            Pick MI for Leaders or MI for Clinicians, and you get a join code to share at
            your next session. You assign from the library of {drillCount} drills,{" "}
            {scenarioCount} role-plays, and the lessons from both pathways, filtered to the
            cohort&apos;s track. Learners see your instructions and the due date in the app.
          </p>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-white">
            You see assigned and completed work for everyone. You read a conversation only
            when a learner sends it to you, and they can withdraw it.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function TrainersSections() {
  return (
    <>
      <TrainerWeek />
      <AnnotatedDashboard />
      <CohortSetup />
      <div className="border-b-2 border-line bg-soft">
        <Scenarios
          variant="list"
          heading={`${scenarioCount} role-plays you can assign`}
          body="Each one comes with a brief for the learner and a difficulty level. The backstory stays hidden until the learner draws it out."
        />
      </div>
    </>
  );
}

/** For the closing band: the written feedback from the dashboard sample. */
export function SampleFeedback() {
  return (
    <figure className="mx-auto max-w-sm">
      <p className="text-sm font-extrabold text-primary-shadow">Your feedback to Jordan</p>
      <blockquote className="mt-2 rounded-[1.5rem] border-2 border-line bg-soft px-5 py-4 font-display text-xl font-semibold leading-snug text-ink">
        Your reflection about being the one finance counts on is what opened him up. At the
        time-blocking moment, try reflecting first.
      </blockquote>
      <figcaption className="mt-3 pl-1 text-sm font-semibold text-muted">
        Sample review on a shared role-play
      </figcaption>
    </figure>
  );
}
