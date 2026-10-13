import { CtaNote, GetTheApp } from "../get-the-app";
import { ProductMoment } from "./product-moment";

export function Hero() {
  return (
    <section className="overflow-x-clip">
      <div className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-14 px-5 pt-8 pb-16 md:px-8 md:pt-14 lg:grid-cols-12 lg:pt-16 lg:pb-24">
        <div className="lg:col-span-6">
          <p className="mb-4 inline-flex rounded-xl bg-soft px-3 py-1.5 text-sm font-extrabold text-primary-shadow">
            Motivational interviewing practice for leaders and clinicians
          </p>
          <h1 className="max-w-[15ch] pb-1 font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl lg:text-[3.6rem]">
            Practice the conversation before you have it.
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg font-semibold leading-snug text-muted [text-wrap:balance]">
            Rehearse hard conversations with a simulated employee or patient
            who gets defensive when lectured and opens up when you reflect.
          </p>
          <p className="mt-4 max-w-[52ch] text-base font-semibold leading-snug text-ink">
            Two ways to practice:{" "}
            <a
              href="/for/leaders"
              className="font-extrabold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              as a leader
            </a>{" "}
            with your team, or{" "}
            <a
              href="/for/clinicians"
              className="font-extrabold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              as a clinician
            </a>{" "}
            with your patients.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <GetTheApp location="hero" size="lg" />
            <a
              href="/for/trainers"
              className="text-base font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Leading a training?
            </a>
          </div>
          <CtaNote className="mt-4" />
        </div>

        <div className="lg:col-span-6 lg:pl-4">
          <ProductMoment />
        </div>
      </div>
    </section>
  );
}
