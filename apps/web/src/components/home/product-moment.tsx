import { Keyboard, Microphone, SpeakerHigh } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { CSSProperties } from "react";
import { COACH_MASCOT } from "@/lib/mascot-art";

/** CSS custom properties for the sequence in globals.css (`.pm-*`). */
function at(ms: number, extra: Record<string, string | number> = {}): CSSProperties {
  return { "--pm-delay": `${ms}ms`, ...extra } as CSSProperties;
}

const BARS = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75];

/**
 * The hero's product moment: one exchange from the PM-017 role-play ("The reports are
 * late again"), built in HTML so it stays crisp. Josh's opener is his real opening
 * line; the learner answers out loud; the coach names the move. Plays once on load
 * (CSS only), and is fully visible with reduced motion or before CSS animations run.
 */
export function ProductMoment() {
  return (
    <figure className="relative mx-auto w-full max-w-[29rem]">
      <figcaption className="sr-only">
        Example role-play. Josh, a revenue cycle analyst, says: So I&apos;m guessing this
        is about the reports. You answer out loud: Sounds like you&apos;ve been bracing for
        this one. The coach notes: That&apos;s a complex reflection. You named the feeling
        under his words, so he has nothing to defend. Josh replies: Yeah. It&apos;s been
        harder than I let on.
      </figcaption>

      <div
        aria-hidden
        className="absolute -inset-x-3 -top-3 -bottom-4 -z-10 rounded-[2.25rem] bg-soft sm:-inset-x-6 sm:-top-6 sm:-bottom-7"
      />

      <div aria-hidden className="overflow-hidden rounded-[1.75rem] border-2 border-line bg-white shadow-[0_6px_0_var(--shadow)]">
        {/* App header: who you're talking to */}
        <div className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft-deep font-display text-sm font-bold text-primary-shadow">
            DB
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-[15px] font-bold text-ink">Josh Brooks</p>
            <p className="truncate text-[13px] font-bold text-muted">Revenue cycle analyst · Role-play</p>
          </div>
          <SpeakerHigh size={22} weight="bold" className="text-primary" />
        </div>

        <div className="space-y-3 px-4 pt-4 pb-3 text-[15px] font-semibold leading-snug sm:px-5">
          {/* 1. Josh's real opening line */}
          <div className="pm-step flex items-end gap-2" style={at(200)}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft-deep text-[10px] font-extrabold text-primary-shadow">
              DB
            </span>
            <p className="max-w-[85%] rounded-[1.1rem] rounded-bl-md [text-wrap:balance] border-2 border-line bg-white px-3.5 py-2.5 text-ink shadow-[0_3px_0_var(--shadow)]">
              So I&apos;m guessing this is about the reports.
            </p>
          </div>

          {/* 2. The learner holds to talk; the transcript lands as their bubble */}
          <div className="relative flex flex-col items-end gap-1.5">
            <div
              className="pm-transient absolute top-1 right-0 items-center gap-2.5 rounded-full border-2 border-primary-tint bg-soft px-3 py-2 text-[13px] font-extrabold text-primary-shadow"
              style={at(950, { "--pm-hold": "1450ms" })}
            >
              <Microphone size={16} weight="fill" />
              Listening
              <span className="flex h-4 items-center gap-[3px]">
                {BARS.map((h, i) => (
                  <span
                    key={i}
                    className="pm-bar block w-[3px] rounded-full bg-primary"
                    style={at(950, { "--pm-i": i, height: `${Math.round(h * 16)}px` })}
                  />
                ))}
              </span>
            </div>
            <p
              className="pm-step max-w-[85%] rounded-[1.1rem] rounded-br-md bg-primary px-3.5 py-2.5 text-primary-ink shadow-[0_3px_0_var(--primary-shadow)]"
              style={at(2300)}
            >
              Sounds like you&apos;ve been bracing for this one.
            </p>
            <span
              className="pm-step inline-flex items-center gap-1 pr-1 text-xs font-extrabold text-primary-shadow"
              style={at(2450)}
            >
              <Microphone size={13} weight="fill" />
              Said out loud
            </span>
          </div>

          {/* 3. The coach names the move */}
          <div
            className="pm-step pm-pop flex items-start gap-3 rounded-2xl border-2 border-line bg-soft/60 p-3"
            style={at(3150)}
          >
            <Image
              src={COACH_MASCOT.src}
              alt=""
              width={COACH_MASCOT.width}
              height={COACH_MASCOT.height}
              sizes="40px"
              className="h-14 w-auto shrink-0"
            />
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[13px] font-extrabold text-[color:var(--move-reflection-ink)] shadow-[0_2px_0_var(--line)]">
                <span className="block size-2 rotate-45 bg-[color:var(--move-reflection)]" />
                That&apos;s a complex reflection
              </p>
              <p className="mt-1.5 text-sm font-bold leading-snug text-ink">
                You named the feeling under his words, so he has nothing to defend.
              </p>
            </div>
          </div>

          {/* 4. Josh opens up */}
          <div className="relative">
            <div
              className="pm-transient absolute top-0 left-9 items-center gap-1 rounded-[1.1rem] rounded-bl-md border-2 border-line bg-white px-3.5 py-3"
              style={at(3950, { "--pm-hold": "1050ms" })}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="pm-dot block size-1.5 rounded-full bg-faint" style={at(3950, { "--pm-i": i })} />
              ))}
            </div>
            <div className="pm-step flex items-end gap-2" style={at(4900)}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft-deep text-[10px] font-extrabold text-primary-shadow">
                DB
              </span>
              <p className="max-w-[85%] rounded-[1.1rem] rounded-bl-md [text-wrap:balance] border-2 border-line bg-white px-3.5 py-2.5 text-ink shadow-[0_3px_0_var(--shadow)]">
                Yeah. It&apos;s been harder than I let on.
              </p>
            </div>
          </div>
        </div>

        {/* Hold to talk, as in the app */}
        <div className="flex items-center justify-between border-t-2 border-line px-5 py-2.5">
          <Keyboard size={22} weight="bold" className="text-muted" />
          <span className="flex items-center gap-2.5">
            <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-ink shadow-[0_3px_0_var(--primary-shadow)] ring-4 ring-soft">
              <Microphone size={20} weight="fill" />
            </span>
            <span className="text-[13px] font-extrabold text-ink">Hold to talk</span>
          </span>
          <span className="w-[22px]" />
        </div>
      </div>
    </figure>
  );
}
