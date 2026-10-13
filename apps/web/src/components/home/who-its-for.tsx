import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Reveal } from "../reveal";

const paths = [
  {
    href: "/for/leaders",
    name: "Leaders",
    who: "Managers, supervisors and charge nurses",
    what: "Practice performance, change and burnout conversations with a simulated employee.",
  },
  {
    href: "/for/clinicians",
    name: "Clinicians",
    who: "Clinicians and health coaches",
    what: "Keep your MI sharp with simulated patients, five minutes at a time.",
  },
  {
    href: "/for/trainers",
    name: "Trainers",
    who: "MI trainers and team leads",
    what: "Assign practice to a group and review the role-plays they send you.",
  },
];

export function WhoItsFor() {
  return (
    <section id="who-its-for" aria-labelledby="who-heading" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal className="max-w-2xl">
          <h2
            id="who-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-[2.6rem]"
          >
            Who it&apos;s for
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-muted">
            Pick the path that fits how you use MI.
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {paths.map((p, i) => (
            <li key={p.href}>
              <Reveal delay={0.05 * i} className="h-full">
                <Link
                  href={p.href}
                  className="group flex h-full flex-col rounded-[1.5rem] border-2 border-line bg-white p-6 shadow-[0_6px_0_var(--shadow)] hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-7"
                >
                  <span className="font-display text-2xl font-bold text-ink">{p.name}</span>
                  <span className="mt-1 text-sm font-extrabold text-primary-shadow">{p.who}</span>
                  <span className="mt-4 flex-1 font-semibold leading-snug text-muted">{p.what}</span>
                  <span className="mt-6 inline-flex items-center gap-2 font-extrabold text-ink group-hover:text-primary">
                    See the {p.name.toLowerCase()} path
                    <ArrowRight size={18} weight="bold" aria-hidden />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
