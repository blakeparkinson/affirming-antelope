import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Keyboard, Microphone } from "@phosphor-icons/react/dist/ssr";
import { getDrill, getScenario, scenarioFrame, type Debrief, type DrillFeedback, type SelfReflection, type Turn } from "@antelope/core";
import { createClient } from "@/lib/supabase/server";
import { isUuid, requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { DIFFICULTY, FEELING, ago, counterpartOf, duration, skillName } from "@/lib/trainer/content";
import { buildExchanges } from "@/lib/trainer/exchanges";
import { Avatar, Badge, Card, Eyebrow, SectionTitle, buttonClass } from "@/components/trainer/ui";
import { FadeIn } from "@/components/trainer/motion";
import { ReviewOpened } from "@/components/analytics/review-opened";
import { AiFeedback } from "@/components/trainer/review/ai-feedback";
import { Transcript } from "@/components/trainer/review/transcript";
import { FeedbackPanel, type ExistingReview } from "@/components/trainer/review/feedback-panel";
import { JumpToFeedback } from "@/components/trainer/review/jump-to-feedback";

export const metadata = { title: "Review" };

function isDebrief(v: unknown): v is Debrief {
  const d = v as Debrief;
  return !!d && Array.isArray(d.annotations) && Array.isArray(d.trajectory) && !!d.tallies;
}
function isDrillFeedback(v: unknown): v is DrillFeedback {
  const d = v as DrillFeedback;
  return !!d && typeof d.move === "string" && Array.isArray(d.possibleResponses);
}

export default async function SubmissionPage({ params }: PageProps<"/trainer/submissions/[submissionId]">) {
  const viewer = await requireTrainer();
  const { submissionId } = await params;
  if (!isUuid(submissionId)) notFound();
  const supabase = await createClient();

  // RLS returns this only if it was submitted (not withdrawn) to a cohort the viewer trains.
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "id, cohort_id, status, note_to_trainer, submitted_at, reviewed_at, profiles!submissions_user_id_fkey(display_name), practice_sessions(id, kind, ref_id, skill, mode, transcript, debrief, self_reflection, started_at, ended_at, duration_sec), reviews(id, trainer_id, feedback, audio_path, rating, recommended_kind, recommended_ref, try_again, created_at, updated_at, learner_seen_at)",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) notFound();
  const cohort = await requireTrainedCohort(sub.cohort_id);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const session = one(sub.practice_sessions);
  if (!session) notFound();
  const learner = one(sub.profiles)?.display_name ?? "Learner";
  const first = learner.split(/\s+/)[0];
  const review = one(sub.reviews);

  let audioUrl: string | null = null;
  if (review?.audio_path) {
    const { data } = await supabase.storage.from("review-audio").createSignedUrl(review.audio_path, 60 * 60);
    audioUrl = data?.signedUrl ?? null;
  }

  const scenario = session.kind === "roleplay" ? getScenario(session.ref_id) : undefined;
  const drill = session.kind === "drill" ? getDrill(session.ref_id) : undefined;
  const turns = (Array.isArray(session.transcript) ? session.transcript : []) as unknown as Turn[];
  const debrief = isDebrief(session.debrief) ? session.debrief : null;
  const drillFeedback = !debrief && isDrillFeedback(session.debrief) ? session.debrief : null;
  const reflection = (session.self_reflection ?? null) as unknown as SelfReflection | null;
  const exchanges = debrief ? buildExchanges(turns, debrief) : [];
  // "Patient", "Employee" or "Athlete": the scenario's frame, else the drill's setting.
  const counterpart = counterpartOf(scenario ? scenarioFrame(scenario) : drill?.setting);
  const personaName = scenario?.persona.name ?? `The ${counterpart.toLowerCase()}`;

  const existing: ExistingReview | null = review
    ? {
        id: review.id,
        feedback: review.feedback,
        audioPath: review.audio_path,
        audioUrl,
        rating: review.rating,
        recommendedKind: review.recommended_kind as ExistingReview["recommendedKind"],
        recommendedRef: review.recommended_ref,
        tryAgain: review.try_again,
        updatedAt: review.updated_at,
        updatedLabel: ago(review.updated_at),
        seenLabel: review.learner_seen_at ? ago(review.learner_seen_at) : null,
        mine: review.trainer_id === viewer.id,
      }
    : null;

  const title = scenario?.title ?? drill?.instruction ?? session.ref_id;
  const ModeIcon = session.mode === "voice" ? Microphone : Keyboard;

  return (
    <div className="mx-auto max-w-[1400px] px-6 pt-6 pb-20 md:px-10">
      <ReviewOpened submittedAt={sub.submitted_at} />
      <Link href={`/trainer/cohorts/${cohort.id}/reviews`} className={buttonClass("ghost", "sm", "-ml-3")}>
        <ArrowLeft size={16} weight="bold" aria-hidden /> {cohort.name} · Reviews
      </Link>

      <div className="mt-4 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid min-w-0 gap-8">
          {/* Header */}
          <FadeIn>
            <header className="flex flex-wrap items-start gap-5">
              <Avatar name={learner} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Eyebrow>{learner}&apos;s submission</Eyebrow>
                  {sub.status === "reviewed" ? <Badge tone="teal">Reviewed</Badge> : <Badge tone="gold">Needs review</Badge>}
                </div>
                <h1 className="mt-1 font-display text-[32px] font-bold leading-[1.08] tracking-tight text-ink">{title}</h1>
                {scenario ? (
                  <p className="mt-1.5 text-[16px] font-bold text-ink/75">
                    {scenario.persona.role.toLowerCase().startsWith(counterpart.toLowerCase()) ? null : (
                      <span className="text-muted">{counterpart}: </span>
                    )}
                    {scenario.persona.name}, {scenario.persona.role} · {scenario.context}: {scenario.issue}
                  </p>
                ) : drill ? (
                  <p className="mt-1.5 text-[16px] font-bold text-ink/75">{drill.context}</p>
                ) : null}
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Session details">
                  <li>
                    <Badge tone="primary">{skillName(session.skill)}</Badge>
                  </li>
                  {scenario ? (
                    <li>
                      <Badge>{DIFFICULTY[scenario.difficulty]}</Badge>
                    </li>
                  ) : null}
                  <li>
                    <Badge>
                      <ModeIcon size={13} weight="bold" aria-hidden />
                      {session.kind === "roleplay"
                        ? `${session.mode === "voice" ? "Voice" : "Text"} role-play with ${/^[aeiou]/i.test(counterpart) ? "an" : "a"} ${counterpart.toLowerCase()}`
                        : "Drill"}
                    </Badge>
                  </li>
                  <li>
                    <Badge>
                      <Clock size={13} weight="bold" aria-hidden /> {duration(session.duration_sec)}
                    </Badge>
                  </li>
                  <li>
                    <Badge>
                      Sent <time dateTime={sub.submitted_at}>{ago(sub.submitted_at).toLowerCase()}</time>
                    </Badge>
                  </li>
                </ul>
              </div>
            </header>
            {sub.note_to_trainer ? (
              <figure className="mt-6 max-w-[64ch] rounded-[20px] rounded-tl-md border-2 border-line bg-soft/60 px-5 py-4">
                <figcaption className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                  {first}&apos;s note to you
                </figcaption>
                <blockquote className="mt-1.5 text-[17px] font-bold leading-snug text-ink">“{sub.note_to_trainer}”</blockquote>
              </figure>
            ) : null}
            {scenario ? (
              <details className="group mt-4 max-w-[64ch] text-[14px]">
                <summary className="cursor-pointer list-none font-extrabold text-primary-shadow underline decoration-primary-tint decoration-2 underline-offset-4 hover:decoration-primary [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show the brief {first} saw</span>
                  <span className="hidden group-open:inline">Hide the brief</span>
                </summary>
                <p className="mt-2 font-semibold leading-relaxed text-ink/80">{scenario.learnerBrief}</p>
                <p className="mt-2 font-bold text-ink">Goal: {scenario.learnerGoal}</p>
              </details>
            ) : null}
          </FadeIn>

          {/* Self-reflection */}
          {reflection ? (
            <FadeIn delay={0.05}>
              <Card aria-labelledby="reflection" className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <SectionTitle id="reflection">{first}&apos;s self-reflection</SectionTitle>
                  <p className="text-[13px] font-semibold text-muted">Written before seeing any AI feedback</p>
                </div>
                <p className="mt-3 text-[15px] font-bold text-ink">
                  Called it{" "}
                  <Badge tone={reflection.feeling === "solid" ? "teal" : reflection.feeling === "rough" ? "clay" : "gold"}>
                    {FEELING[reflection.feeling] ?? reflection.feeling}
                  </Badge>
                </p>
                {reflection.text ? (
                  <blockquote className="mt-3 border-l-4 border-primary-tint pl-4 text-[16px] font-semibold leading-relaxed text-ink/85">
                    {reflection.text}
                  </blockquote>
                ) : null}
              </Card>
            </FadeIn>
          ) : null}

          {/* AI feedback */}
          {debrief ? (
            <AiFeedback
              debrief={debrief}
              turns={turns}
              exchanges={exchanges}
              personaName={personaName}
              counterpart={counterpart}
              learnerFirst={first}
            />
          ) : drillFeedback && drill ? (
            <Card className="p-6" aria-labelledby="drill-fb">
              <SectionTitle id="drill-fb">AI practice feedback</SectionTitle>
              <p className="mt-3 text-[15px] font-semibold text-ink/85">{drillFeedback.observation}</p>
              {drillFeedback.strength ? <p className="mt-2 text-[15px] font-semibold text-[#1f6b60]">{drillFeedback.strength}</p> : null}
              <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">One possible MI-consistent response</p>
              <ul className="mt-2 grid gap-2">
                {drillFeedback.possibleResponses.map((r) => (
                  <li key={r} className="rounded-2xl bg-soft px-4 py-2.5 text-[15px] font-semibold text-ink">
                    “{r}”
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-[15px] font-semibold text-muted">No AI feedback was saved with this session.</p>
            </Card>
          )}

          {/* Transcript */}
          {turns.length ? (
            <Transcript
              turns={turns}
              annotations={debrief?.annotations ?? []}
              keyMomentIds={(debrief?.keyMoments ?? []).map((k) => k.turnId)}
              personaName={personaName}
              counterpart={counterpart}
              learnerName={first}
            />
          ) : null}
        </div>

        <JumpToFeedback label={sub.status === "reviewed" ? "Your review" : "Write feedback"} />
        <FeedbackPanel
          submissionId={sub.id}
          cohortId={cohort.id}
          learnerFirst={first}
          status={sub.status as "submitted" | "reviewed"}
          sessionSkill={session.skill ?? ""}
          scenarioId={scenario?.id ?? null}
          pathwayId={cohort.pathwayId}
          existing={existing}
        />
      </div>
    </div>
  );
}
