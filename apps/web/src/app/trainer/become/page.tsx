import Image from "next/image";
import { redirect } from "next/navigation";
import { Hourglass } from "@phosphor-icons/react/dist/ssr";
import { getMyAccessRequest, requireUser, type AccessRequest } from "@/lib/trainer/dal";
import { declineCooldownUntil, learnerCountLabel } from "@/lib/trainer/access";
import { RequestAccessForm } from "@/components/trainer/request-access-form";
import { TrainerCodeForm } from "@/components/trainer/become-form";
import { SignOutForm } from "@/components/trainer/sign-out-form";
import { buttonClass } from "@/components/trainer/ui";

export const metadata = { title: "Become a trainer" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

function Pending({ request, email }: { request: AccessRequest; email: string | null }) {
  return (
    <div className="mt-6">
      <div className="flex items-start gap-4 rounded-[20px] border-2 border-line bg-soft/60 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-tint text-gold-ink" aria-hidden>
          <Hourglass size={24} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[19px] font-bold leading-snug text-ink">Request sent</p>
          <p className="mt-1 text-[15px] font-semibold leading-relaxed text-ink/80">
            Thanks, {request.name}. We'll review it shortly.
            {email ? (
              <>
                {" "}
                We&apos;ll email you at <span className="font-extrabold text-ink">{email}</span>.
              </>
            ) : null}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-[14px] sm:grid-cols-3">
        <div>
          <dt className="font-bold text-muted">Organization</dt>
          <dd className="mt-0.5 font-extrabold text-ink">{request.organization}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Learners</dt>
          <dd className="mt-0.5 font-extrabold text-ink">{learnerCountLabel(request.learnerCount)}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">Sent</dt>
          <dd className="mt-0.5 font-extrabold text-ink">{dateFmt.format(new Date(request.createdAt))}</dd>
        </div>
      </dl>
    </div>
  );
}

function Declined({ until }: { until: Date }) {
  return (
    <div className="mt-6 rounded-[20px] border-2 border-line bg-soft/60 p-5">
      <p className="font-display text-[19px] font-bold leading-snug text-ink">Not this time</p>
      <p className="mt-1 text-[15px] font-semibold leading-relaxed text-ink/80">
        We couldn&apos;t approve your last request. You&apos;re welcome to send a new one on {dateFmt.format(until)}, or
        use a trainer code below if your program lead gives you one.
      </p>
    </div>
  );
}

export default async function BecomeTrainerPage() {
  const viewer = await requireUser("/trainer/become");
  if (viewer.canTrain) redirect("/trainer");
  const request = await getMyAccessRequest();

  const pending = request?.status === "pending" ? request : null;
  const coolingOff = request?.status === "declined" ? declineCooldownUntil(request.decidedAt) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-soft/50">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Image src="/brand-lockup-horizontal-deep.svg" alt="Affirming Antelope" width={700} height={180} className="h-9 w-auto" priority />
        <SignOutForm>
          <button type="submit" className={buttonClass("ghost", "sm")}>
            Sign out
          </button>
        </SignOutForm>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="grid w-full max-w-[920px] items-center gap-10 md:grid-cols-[1fr_auto]">
          <div className="rounded-[24px] border-2 border-line bg-white p-8 shadow-[0_6px_0_var(--shadow)] sm:p-10">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">One more step</p>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] text-ink">Become a trainer</h1>
            {pending ? (
              <Pending request={pending} email={viewer.email} />
            ) : coolingOff ? (
              <Declined until={coolingOff} />
            ) : (
              <>
                <p className="mt-3 max-w-[50ch] text-[16px] font-semibold leading-relaxed text-muted">
                  Trainers create cohorts, assign practice, and review the role-plays their learners send. Tell us a little
                  about your group and we&apos;ll set you up. You&apos;re signed in as{" "}
                  <span className="font-extrabold text-ink">{viewer.email}</span>.
                </p>
                <RequestAccessForm defaultName={viewer.displayName === "Trainer" ? "" : viewer.displayName} />
              </>
            )}

            <div className="mt-8 border-t-2 border-soft pt-6">
              <TrainerCodeForm />
            </div>
            <p className="mt-8 border-t-2 border-soft pt-5 text-[14px] font-semibold leading-relaxed text-muted">
              Joining as a learner? You don&apos;t need any of this. Open the Affirming Antelope app and enter the join code
              your trainer shared.
            </p>
          </div>
          <Image src="/brand-mascot-wave-cartoon-deep.png" alt="" width={674} height={978} className="hidden h-72 w-auto md:block" />
        </div>
      </main>
    </div>
  );
}
