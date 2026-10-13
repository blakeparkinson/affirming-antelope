import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "../reveal";

/**
 * Lines from the PM-017 spec (packages/core/src/scenarios.ts): the sustain triggers
 * a manager reaches for, and how Josh answers them.
 */
const turns = [
  {
    habit: "You lecture",
    you: "Finance needs these on time. It affects the whole team.",
    them: "Okay. Sure. I hear you.",
    result: "He goes flat.",
  },
  {
    habit: "You fix it too early",
    you: "Have you tried time blocking?",
    them: "I'm not sure what you want me to say.",
    result: "He stops offering anything.",
  },
  {
    habit: "You argue with his reasons",
    you: "But the data's final on the 3rd.",
    them: "Technically the data's not final until the 5th anyway.",
    result: "He digs in.",
  },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal className="max-w-2xl">
          <h2
            id="problem-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-[2.6rem]"
          >
            Three ways a one-on-one goes sideways
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-ink/80">
            You mean to help, so you explain and push a little. Josh hears
            pressure and defends himself. MI calls your half of that the
            righting reflex, and you catch it sooner after you&apos;ve rehearsed
            the other move a few times.
          </p>
        </Reveal>

        <ol className="mt-10 space-y-3 md:mt-12">
          {turns.map((turn, i) => (
            <li key={turn.habit}>
              <Reveal
                delay={0.06 * i}
                className="grid items-center gap-3 rounded-[1.25rem] bg-white/70 p-4 md:grid-cols-[11rem_1fr_auto_1fr_11.5rem] md:gap-4 md:p-5"
              >
                <p className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-ink">
                  <span
                    aria-hidden
                    className="block size-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[color:var(--move-inconsistent)]"
                  />
                  {turn.habit}
                </p>
                <p className="justify-self-end rounded-[1.1rem] rounded-br-md bg-primary px-3.5 py-2.5 font-semibold leading-snug text-primary-ink shadow-[0_3px_0_var(--primary-shadow)] md:justify-self-stretch">
                  <span className="sr-only">You: </span>
                  {turn.you}
                </p>
                <ArrowRight
                  size={20}
                  weight="bold"
                  aria-hidden
                  className="hidden text-faint md:block"
                />
                <p className="justify-self-start rounded-[1.1rem] rounded-bl-md border-2 border-line bg-white px-3.5 py-2.5 font-semibold leading-snug text-ink shadow-[0_3px_0_var(--shadow)] md:justify-self-stretch">
                  <span className="sr-only">Josh: </span>
                  {turn.them}
                </p>
                <p className="text-[15px] font-extrabold text-[color:var(--move-inconsistent-ink)]">{turn.result}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
