import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/trainer/dal";
import { SignInForm } from "@/components/trainer/sign-in-form";

export const metadata = { title: "Sign in" };

function safeNext(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/trainer") && !s.startsWith("//") && !s.startsWith("/trainer/sign-in") ? s : "/trainer";
}

export default async function SignInPage({ searchParams }: PageProps<"/trainer/sign-in">) {
  const next = safeNext((await searchParams).next);
  // Guests (anonymous sessions) see the form: signing in replaces their session.
  const viewer = await getViewer();
  if (viewer && !viewer.isAnonymous) redirect(next);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/45">
          <Image src="/brand-lockup-horizontal-deep.svg" alt="Affirming Antelope" width={700} height={180} className="h-9 w-auto" priority />
        </Link>
        <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
          <SignInForm next={next} />
        </main>
        <p className="text-[13px] font-semibold text-muted">
          Learners practice in the Affirming Antelope app. This dashboard is for trainers.
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-soft lg:flex lg:flex-col lg:justify-between lg:p-14" aria-hidden>
        <div className="max-w-[30ch]">
          <p className="font-display text-[34px] font-bold leading-[1.1] text-navy">Coach the moment that mattered.</p>
          <p className="mt-4 text-[17px] font-semibold leading-relaxed text-ink/75">
            See where a conversation opened up or held on, hear what your learner noticed, and leave feedback in your own
            voice.
          </p>
        </div>
        <div className="relative mt-10 flex items-end gap-6">
          <div className="mb-24 max-w-[19rem] rounded-[20px] rounded-bl-md border-2 border-line bg-white px-5 py-4 shadow-[0_5px_0_var(--shadow)]">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">A learner’s note</p>
            <p className="mt-1 text-[15px] font-bold leading-snug text-ink">
              “I lost him around the time-blocking question. How would you have handled that moment?”
            </p>
          </div>
          <Image src="/brand-mascot-wave-cartoon-deep.png" alt="" width={674} height={978} className="h-[22rem] w-auto" priority />
        </div>
      </aside>
    </div>
  );
}
