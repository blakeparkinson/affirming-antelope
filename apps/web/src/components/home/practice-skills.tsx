import { MI_FOR_LEADERS } from "@antelope/core";
import { Reveal } from "../reveal";

/** OARS in plain words, each with one line a manager might say to Josh (PM-017). */
const skills = [
  {
    letter: "O",
    name: "Open questions",
    plain: "Ask questions that invite the story behind the yes or no.",
    example: "What's changed for you over the last few months?",
  },
  {
    letter: "A",
    name: "Affirmations",
    plain: "Name a strength you've seen, with the detail that shows you noticed.",
    example: "For four years, finance has counted on your numbers.",
  },
  {
    letter: "R",
    name: "Reflections",
    plain: "Say back what they mean, including the feeling under it.",
    example: "It's frustrating to flag the template twice and hear nothing back.",
  },
  {
    letter: "S",
    name: "Summaries",
    plain: "Gather what they've told you so they can hear it, then ask what's next.",
    example: "So the template eats two days, and you don't want to be the holdup. What would help?",
  },
];

export function PracticeSkills() {
  return (
    <section aria-labelledby="skills-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal className="max-w-2xl">
          <h2
            id="skills-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-[2.6rem]"
          >
            Four moves that keep people talking
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-muted">
            MI calls them OARS. The {MI_FOR_LEADERS.units.length}-week MI for
            Leaders path drills them one at a time, then has you use them
            together in role-plays.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {skills.map((skill, i) => (
            <li key={skill.letter}>
            <Reveal delay={0.05 * (i % 2)} className="flex h-full gap-5 border-t-2 border-line pt-6">
              <span
                aria-hidden
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-soft font-display text-3xl font-bold text-primary-shadow shadow-[0_4px_0_var(--soft-deep)]"
              >
                {skill.letter}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold text-ink">{skill.name}</h3>
                <p className="mt-1 font-semibold leading-snug text-muted">{skill.plain}</p>
                <div className="mt-4">
                  <span className="block text-xs font-extrabold text-primary-shadow">Try saying</span>
                  <q className="mt-1 inline-block rounded-[1.1rem] rounded-br-md bg-primary px-3.5 py-2.5 font-semibold leading-snug text-primary-ink shadow-[0_3px_0_var(--primary-shadow)] before:content-none after:content-none">
                    {skill.example}
                  </q>
                </div>
              </div>
            </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
