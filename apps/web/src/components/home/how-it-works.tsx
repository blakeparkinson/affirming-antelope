import { Keyboard, Microphone, Quotes } from "@phosphor-icons/react/dist/ssr";
import { MI_FOR_LEADERS } from "@antelope/core";
import { Hoofprint } from "../hoofprint";
import { Reveal } from "../reveal";

function StepNumber({ n, inverse = false }: { n: number; inverse?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-2xl font-display text-xl font-bold ${
        inverse
          ? "bg-white text-primary-shadow shadow-[0_4px_0_var(--navy)]"
          : "bg-primary text-primary-ink shadow-[0_4px_0_var(--primary-shadow)]"
      }`}
    >
      {n}
    </span>
  );
}

// Week 3 of MI for Leaders, as the app lists it: a drill, then the first role-play.
const week3 = MI_FOR_LEADERS.units[2];
const kindLabel = { learn: "Lesson", drill: "Drill", roleplay: "Role-play" } as const;
const today = week3.activities
  .filter((a) => a.kind !== "learn")
  .slice(-2)
  .map((a) => ({ kind: `Week ${week3.week} · ${kindLabel[a.kind]}`, title: a.title, time: `${a.minutes} min` }));

/** Today's practice, then the app's hold-to-talk control. */
function HoldToTalk() {
  return (
    <div aria-hidden className="mt-6 space-y-3">
      <ul className="space-y-2">
        {today.map((item) => (
          <li key={item.title} className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line px-4 py-3">
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-muted">{item.kind}</span>
              <span className="block truncate font-display text-base font-bold text-ink">{item.title}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-soft px-2.5 py-1 text-sm font-extrabold text-primary-shadow">{item.time}</span>
          </li>
        ))}
      </ul>
    <div className="flex items-center justify-center gap-6 rounded-2xl bg-soft px-5 py-5">
      <span className="grid size-11 place-items-center rounded-xl border-2 border-line bg-white text-muted">
        <Keyboard size={22} weight="bold" />
      </span>
      <span className="flex flex-col items-center gap-2">
        <span className="grid size-[4.5rem] place-items-center rounded-full bg-primary text-primary-ink shadow-[0_5px_0_var(--primary-shadow)] ring-8 ring-primary-tint/60">
          <Microphone size={30} weight="fill" />
        </span>
        <span className="text-sm font-extrabold text-ink">Hold to talk</span>
      </span>
      <span className="w-11" />
    </div>
    </div>
  );
}

// "How the conversation moved", from the debrief: how open the employee was after each reply.
const W = 320;
const H = 150;
const xs = [24, 70, 116, 162, 208, 254, 300];
const ys = [124, 122, 90, 74, 34, 66, 28];
const line = xs.map((x, i) => `${i ? "L" : "M"}${x} ${ys[i]}`).join(" ");

export function ReplayChart({ who = "employee" }: { who?: "employee" | "patient" }) {
  return (
    <figure className="mt-6 rounded-2xl border-2 border-line bg-white p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-base font-bold text-ink">How the conversation moved</span>
        <span className="whitespace-nowrap text-xs font-extrabold text-muted">Sample debrief</span>
      </figcaption>
      <div className="mt-3 grid grid-cols-[4.5rem_1fr] gap-2">
        <div aria-hidden className="flex flex-col justify-between py-1 text-[11px] font-extrabold leading-tight">
          <span className="text-primary-shadow">Open to change</span>
          <span className="text-muted">Mixed</span>
          <span className="text-[color:var(--zone-hold-ink)]">Holding on</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Sample chart: the ${who} starts holding on, moves to mixed after reflections, and ends open to change.`}
        >
          <rect x="0" y="0" width={W} height="46" rx="10" fill="var(--zone-change)" />
          <rect x="0" y="104" width={W} height="46" rx="10" fill="var(--zone-hold)" />
          <line x1="0" x2={W} y1="75" y2="75" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 6" />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, i) =>
            i === 5 ? (
              <g key={x}>
                <circle cx={x} cy={ys[i]} r="11" fill="#fff" stroke="var(--gold)" strokeWidth="3" />
                <path d={`M${x} ${ys[i] - 5} l5 8 h-10 Z`} fill="var(--move-inconsistent)" />
              </g>
            ) : (
              <circle key={x} cx={x} cy={ys[i]} r="6" fill="#fff" stroke="var(--primary)" strokeWidth="3" />
            ),
          )}
          {[1, 3].map((i) => {
            const x = (xs[i] + xs[i + 1]) / 2;
            const y = (ys[i] + ys[i + 1]) / 2;
            return <rect key={i} x={x - 5} y={y - 5} width="10" height="10" transform={`rotate(45 ${x} ${y})`} fill="var(--move-reflection)" />;
          })}
        </svg>
      </div>
      <div className="mt-4 rounded-xl bg-soft px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-primary-shadow">
          <Quotes size={14} weight="fill" aria-hidden />
          One possible MI-consistent response
        </p>
        <p className="mt-1 text-[15px] font-bold leading-snug text-ink">
          It sounds like there&apos;s a lot on your plate, and part of you isn&apos;t sure this
          is the right time to talk about it.
        </p>
      </div>
    </figure>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 bg-primary text-primary-ink"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2
            id="how-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-[2.6rem]"
          >
            What it is
          </h2>
          <p className="mt-3 max-w-[56ch] text-lg font-semibold text-[color:var(--on-primary-body)]">
            Short drills and role-plays for the four core MI skills, OARS: open questions, affirmations, reflections and summaries. A drill before work, a role-play when you have ten minutes, then the real conversation.
          </p>
        </Reveal>

        <ol className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          <li className="lg:col-span-5">
            <Reveal className="flex h-full flex-col rounded-[1.5rem] bg-white p-6 text-ink shadow-[0_6px_0_var(--primary-shadow)] md:p-7">
              <div className="flex items-center gap-3">
                <StepNumber n={1} />
                <h3 className="font-display text-2xl font-bold">Practice</h3>
              </div>
              <p className="mt-4 text-[17px] font-semibold leading-relaxed text-muted">
                Pick a drill or a role-play. Type your reply, or hold to talk and
                say it out loud. The employee answers in their own voice.
              </p>
              <div className="mt-auto">
                <HoldToTalk />
              </div>
            </Reveal>
          </li>

          <li className="lg:col-span-7">
            <Reveal
              delay={0.06}
              className="h-full rounded-[1.5rem] bg-white p-6 text-ink shadow-[0_6px_0_var(--primary-shadow)] md:p-7"
            >
              <div className="flex items-center gap-3">
                <StepNumber n={2} />
                <h3 className="font-display text-2xl font-bold">Notice</h3>
              </div>
              <p className="mt-4 max-w-[52ch] text-[17px] font-semibold leading-relaxed text-muted">
                The debrief replays how the conversation moved. The coach marks
                the moments where the employee opened up or dug in, and offers
                one possible MI-consistent response.
              </p>
              <ReplayChart />
            </Reveal>
          </li>

          <li className="lg:col-span-12">
            <Reveal
              delay={0.12}
              className="flex flex-col gap-6 rounded-[1.5rem] border-2 border-white/25 bg-primary-shadow p-6 md:flex-row md:items-center md:justify-between md:p-7"
            >
              <div className="flex items-start gap-4">
                <StepNumber n={3} inverse />
                <div>
                  <h3 className="font-display text-2xl font-bold">Use it</h3>
                  <p className="mt-1 max-w-[50ch] text-[17px] font-semibold leading-relaxed text-[color:var(--on-primary-body)]">
                    Close the app and walk into the one-on-one. Come back tomorrow
                    for the next drill and keep your streak going.
                  </p>
                </div>
              </div>
              <div aria-hidden className="flex items-center gap-1 self-start rounded-2xl bg-white/10 px-4 py-3 md:self-auto">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Hoofprint
                    key={i}
                    className={`size-7 ${i % 2 ? "translate-y-1.5 rotate-[8deg]" : "-translate-y-1 -rotate-[8deg]"}`}
                    fill={i < 4 ? "var(--gold)" : "rgba(255,255,255,0.35)"}
                  />
                ))}
                <span className="ml-3 whitespace-nowrap font-display text-lg font-bold">4-day streak</span>
              </div>
            </Reveal>
          </li>
        </ol>
      </div>
    </section>
  );
}
