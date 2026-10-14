"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle, Info, PencilSimple } from "@phosphor-icons/react";
import type { ReviewRating } from "@antelope/core";
import { saveReview } from "@/app/trainer/actions";
import { track } from "@/lib/analytics/client";
import { createClient } from "@/lib/supabase/client";
import { DIFFICULTY, RATINGS, catalogFor, skillName } from "@/lib/trainer/content";
import { AudioRecorder, Player, type Clip } from "./audio-recorder";
import { Badge, buttonClass, focusRing } from "../ui";

export interface ExistingReview {
  id: string;
  feedback: string;
  audioPath: string | null;
  audioUrl: string | null;
  rating: string | null;
  recommendedKind: "learn" | "drill" | "roleplay" | null;
  recommendedRef: string | null;
  tryAgain: boolean;
  updatedAt: string;
  updatedLabel: string;
  seenLabel: string | null;
  mine: boolean;
}

type RecKind = "learn" | "drill" | "roleplay";

function encodeRec(kind: RecKind | null, ref: string | null): string {
  return kind && ref ? `${kind}:${ref}` : "";
}
function decodeRec(v: string): { kind: RecKind | null; ref: string | null } {
  const i = v.indexOf(":");
  if (i < 0) return { kind: null, ref: null };
  return { kind: v.slice(0, i) as RecKind, ref: v.slice(i + 1) };
}

export function FeedbackPanel({
  submissionId,
  cohortId,
  learnerFirst,
  status: initialStatus,
  sessionSkill,
  scenarioId,
  pathwayId,
  existing,
}: {
  submissionId: string;
  cohortId: string;
  learnerFirst: string;
  status: "submitted" | "reviewed";
  sessionSkill: string;
  scenarioId: string | null;
  /** The cohort's pathway: recommendations come from its setting and lessons. */
  pathwayId: string;
  existing: ExistingReview | null;
}) {
  const catalog = useMemo(() => catalogFor(pathwayId), [pathwayId]);
  const router = useRouter();
  const reduce = useReducedMotion();
  const uid = useId();
  const [status, setStatus] = useState(initialStatus);
  const [editing, setEditing] = useState(!existing);
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");
  const [rating, setRating] = useState<string | null>(existing?.rating ?? null);
  const [rec, setRec] = useState(encodeRec(existing?.recommendedKind ?? null, existing?.recommendedRef ?? null));
  const [tryAgain, setTryAgain] = useState(existing?.tryAgain ?? false);
  const [clip, setClip] = useState<Clip | null>(null);
  const [storedUrl, setStoredUrl] = useState<string | null>(existing?.audioUrl ?? null);
  const [removeStored, setRemoveStored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ at: string; first: boolean } | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [, start] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [baseline, setBaseline] = useState({
    feedback: existing?.feedback ?? "",
    rating: existing?.rating ?? null,
    rec: encodeRec(existing?.recommendedKind ?? null, existing?.recommendedRef ?? null),
    tryAgain: existing?.tryAgain ?? false,
  });
  const dirty =
    feedback !== baseline.feedback ||
    rating !== baseline.rating ||
    rec !== baseline.rec ||
    tryAgain !== baseline.tryAgain ||
    !!clip ||
    removeStored;

  useEffect(() => {
    if (!dirty || !editing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editing]);

  // Autosize the textarea.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(520, Math.max(120, el.scrollHeight + 4))}px`;
  }, [feedback, editing]);

  const recOptions = useMemo(() => {
    const skill = sessionSkill;
    const drillsForSkill = catalog.drills.filter((d) => d.skill === skill);
    return { drillsForSkill, skill };
  }, [sessionSkill, catalog]);

  const recDetail = useMemo(() => {
    const { kind, ref } = decodeRec(rec);
    if (!kind || !ref) return null;
    if (kind === "drill") {
      const d = catalog.drills.find((x) => x.id === ref);
      return d ? { label: "Short practice", title: d.instruction, sub: `${skillName(d.skill)} · Level ${d.level} · “${d.prompt}”` } : null;
    }
    if (kind === "roleplay") {
      const s = catalog.scenarios.find((x) => x.id === ref);
      return s ? { label: "Role-play", title: s.title, sub: `${s.persona} · ${DIFFICULTY[s.difficulty]} · ${skillName(s.skill)}` } : null;
    }
    const l = catalog.lessons.find((x) => x.id === ref);
    return l ? { label: "Lesson", title: l.title, sub: `Week ${l.week} · ${l.unitTitle}` } : null;
  }, [rec, catalog]);

  const busy = phase !== "idle";
  const hasAudio = !!clip || (!!storedUrl && !removeStored);
  const canSave = !busy && (feedback.trim().length > 0 || hasAudio) && (dirty || !existing);

  async function save() {
    if (!canSave) {
      if (!feedback.trim() && !hasAudio) setError("Add written or audio feedback before saving.");
      return;
    }
    setError(null);
    let uploaded: string | null = null;
    const supabase = createClient();
    if (clip) {
      setPhase("uploading");
      const path = `${cohortId}/${submissionId}/${crypto.randomUUID()}.${clip.ext}`;
      const { error: upErr } = await supabase.storage.from("review-audio").upload(path, clip.blob, { contentType: clip.mime, upsert: false });
      if (upErr) {
        setPhase("idle");
        setError("The recording didn't upload. Check your connection and save again.");
        return;
      }
      uploaded = path;
    }
    setPhase("saving");
    const { kind, ref } = decodeRec(rec);
    const res = await saveReview({
      submissionId,
      feedback,
      rating,
      recommendedKind: kind,
      recommendedRef: ref,
      tryAgain,
      audio: uploaded ? { action: "replace", path: uploaded } : removeStored ? { action: "remove" } : { action: "keep" },
    });
    if (!res.ok) {
      if (uploaded) await supabase.storage.from("review-audio").remove([uploaded]);
      setPhase("idle");
      setError(res.error);
      return;
    }
    // Flags and an enum only: never the feedback text, the audio, or the learner.
    track("review_saved", {
      ...(rating ? { rating: rating as ReviewRating } : {}),
      has_audio: hasAudio,
      has_recommendation: !!kind && !!ref,
      try_again: tryAgain,
      is_edit: !!existing || status === "reviewed",
    });
    // New stored clip: play it back from the blob we already have.
    if (uploaded && clip) setStoredUrl(clip.url);
    if (removeStored) setStoredUrl(null);
    setClip(null);
    setRemoveStored(false);
    setBaseline({ feedback, rating, rec, tryAgain });
    setSaved({ at: res.data.updatedAt, first: status !== "reviewed" });
    setStatus("reviewed");
    setEditing(false);
    setPhase("idle");
    start(() => router.refresh());
  }

  const ratingHint = RATINGS.find((r) => r.id === rating)?.hint;

  return (
    <aside aria-labelledby={`${uid}-title`} className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto xl:pb-2" id="feedback">
      <div className="rounded-[24px] border-2 border-line bg-white shadow-[0_5px_0_var(--shadow)]">
        <div className="flex items-center justify-between gap-3 border-b-2 border-soft px-6 pt-5 pb-4">
          <h2 id={`${uid}-title`} className="font-display text-[20px] font-bold text-ink">
            Your feedback
          </h2>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
            >
              {status === "reviewed" ? <Badge tone="teal">Reviewed</Badge> : <Badge tone="gold">Needs review</Badge>}
            </motion.span>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!editing ? (
            <motion.div
              key="summary"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-6 py-5"
            >
              {saved ? (
                <motion.div
                  initial={reduce ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 20 }}
                  className="mb-5 flex items-center gap-3 rounded-2xl bg-[#e3f3f0] px-4 py-3"
                  role="status"
                >
                  <motion.span initial={reduce ? false : { rotate: -30, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.08 }}>
                    <CheckCircle size={26} weight="fill" className="text-[#2e8c7e]" aria-hidden />
                  </motion.span>
                  <p className="text-[14px] font-bold text-[#1f5a51]">
                    {saved.first ? `Saved. ${learnerFirst} will see your review in the app.` : "Review updated."}
                  </p>
                </motion.div>
              ) : existing ? (
                <p className="mb-4 text-[13px] font-semibold text-muted">
                  Saved {existing.updatedLabel.toLowerCase()}
                  {existing.seenLabel ? ` · ${learnerFirst} opened it ${existing.seenLabel.toLowerCase()}` : ` · ${learnerFirst} hasn't opened it yet`}
                </p>
              ) : null}
              <ReviewSummary feedback={feedback} hasAudio={!!storedUrl} audioUrl={storedUrl} rating={rating} recDetail={recDetail} tryAgain={tryAgain} learnerFirst={learnerFirst} />
              {existing?.mine !== false ? (
                <button type="button" onClick={() => { setSaved(null); setEditing(true); }} className={buttonClass("secondary", "md", "mt-5 w-full")}>
                  <PencilSimple size={16} weight="bold" aria-hidden /> Edit review
                </button>
              ) : (
                <p className="mt-5 text-[13px] font-semibold text-muted">Another trainer wrote this review.</p>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid gap-5 px-6 py-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
            >
              <div>
                <label htmlFor={`${uid}-fb`} className="block text-[14px] font-extrabold text-ink">
                  Written feedback
                </label>
                <textarea
                  ref={textRef}
                  id={`${uid}-fb`}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  maxLength={10000}
                  placeholder={`Start with something ${learnerFirst} did well, then the one moment to try differently.`}
                  className="mt-2 block min-h-[120px] w-full resize-none rounded-2xl border-2 border-line bg-white px-4 py-3 text-[15px] font-semibold leading-relaxed text-ink placeholder:text-faint transition-colors hover:border-primary-tint focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                />
              </div>

              <div>
                <p className="text-[14px] font-extrabold text-ink" id={`${uid}-audio`}>
                  Audio feedback <span className="font-semibold text-muted">(optional)</span>
                </p>
                <div className="mt-2" role="group" aria-labelledby={`${uid}-audio`}>
                  <AudioRecorder
                    clip={clip}
                    onClip={setClip}
                    storedUrl={removeStored ? null : storedUrl}
                    onRemoveStored={() => setRemoveStored(true)}
                    learnerFirst={learnerFirst}
                  />
                  {removeStored && !clip ? (
                    <p className="mt-2 text-[13px] font-bold text-muted">
                      The saved recording will be removed when you save.{" "}
                      <button type="button" onClick={() => setRemoveStored(false)} className={`rounded font-extrabold text-primary-shadow underline ${focusRing}`}>
                        Undo
                      </button>
                    </p>
                  ) : null}
                </div>
              </div>

              <fieldset>
                <legend className="text-[14px] font-extrabold text-ink">
                  Where {learnerFirst} is with this skill <span className="font-semibold text-muted">(optional)</span>
                </legend>
                <div role="radiogroup" aria-label="Level" className="mt-2 grid grid-cols-4 gap-1.5">
                  {RATINGS.map((r) => {
                    const on = rating === r.id;
                    return (
                      <label
                        key={r.id}
                        className={`relative cursor-pointer rounded-xl border-2 px-1 py-2 text-center text-[13px] font-extrabold transition-[border-color,background-color,color] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary/40 ${
                          on ? "border-primary bg-primary-tint/35 text-primary-shadow" : "border-line text-ink/80 hover:border-primary-tint"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-rating`}
                          value={r.id}
                          checked={on}
                          onChange={() => setRating(r.id)}
                          onClick={() => on && setRating(null)}
                          className="sr-only"
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 min-h-5 text-[13px] font-semibold text-muted" aria-live="polite">
                  {ratingHint ?? "A level, not a grade. Click a selected level again to clear it."}
                </p>
              </fieldset>

              <div>
                <label htmlFor={`${uid}-rec`} className="block text-[14px] font-extrabold text-ink">
                  Recommend a practice <span className="font-semibold text-muted">(optional)</span>
                </label>
                <select
                  id={`${uid}-rec`}
                  value={rec}
                  onChange={(e) => setRec(e.target.value)}
                  className={`mt-2 block w-full rounded-2xl border-2 border-line bg-white px-3 py-2.5 text-[14px] font-bold text-ink hover:border-primary-tint focus:border-primary focus:outline-none ${focusRing}`}
                >
                  <option value="">No recommendation</option>
                  {recOptions.drillsForSkill.length ? (
                    <optgroup label={`${skillName(recOptions.skill)} drills (this session's skill)`}>
                      {recOptions.drillsForSkill.map((d) => (
                        <option key={`s-${d.id}`} value={`drill:${d.id}`}>
                          L{d.level} · {d.instruction}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="Role-plays">
                    {catalog.scenarios.map((s) => (
                      <option key={s.id} value={`roleplay:${s.id}`}>
                        {s.id === scenarioId ? "This scenario again: " : ""}
                        {s.title} ({DIFFICULTY[s.difficulty]})
                      </option>
                    ))}
                  </optgroup>
                  {catalog.drillSkills.filter((s) => s !== recOptions.skill).map((s) => (
                    <optgroup key={s} label={`${skillName(s)} drills`}>
                      {catalog.drills.filter((d) => d.skill === s).map((d) => (
                        <option key={d.id} value={`drill:${d.id}`}>
                          L{d.level} · {d.instruction}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="Lessons">
                    {catalog.lessons.map((l) => (
                      <option key={l.id} value={`learn:${l.id}`}>
                        Week {l.week} · {l.title}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <AnimatePresence initial={false}>
                  {recDetail ? (
                    <motion.div
                      key={rec}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-2xl bg-soft px-4 py-3">
                        <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">{recDetail.label}</p>
                        <p className="mt-0.5 text-[14px] font-extrabold text-ink">{recDetail.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold text-muted">{recDetail.sub}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border-2 border-line px-4 py-3">
                <div>
                  <p className="text-[14px] font-extrabold text-ink" id={`${uid}-try`}>
                    Ask {learnerFirst} to try again
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-muted" id={`${uid}-try-hint`}>
                    Puts &ldquo;Try again&rdquo; on this scenario in the app.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tryAgain}
                  aria-labelledby={`${uid}-try`}
                  aria-describedby={`${uid}-try-hint`}
                  onClick={() => setTryAgain((v) => !v)}
                  className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${tryAgain ? "bg-primary" : "bg-soft-deep"} ${focusRing}`}
                >
                  <motion.span
                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-[0_2px_0_rgba(10,40,78,0.18)]"
                    animate={{ x: tryAgain ? 20 : 0 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 32 }}
                  />
                </button>
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl bg-[#fbeee7] px-4 py-3 text-[14px] font-bold text-[#9a4a26]"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <div className="sticky bottom-0 z-10 -mx-6 -mb-5 grid gap-2 border-t-2 border-soft bg-white/95 px-6 pt-3 pb-4 backdrop-blur-sm xl:pb-3">
                <button type="submit" disabled={!canSave} className={buttonClass("primary", "lg", "w-full")}>
                  {phase === "uploading" ? "Uploading audio…" : phase === "saving" ? "Saving…" : existing || status === "reviewed" ? "Update review" : "Save review"}
                </button>
                {existing || status === "reviewed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setFeedback(baseline.feedback);
                      setRating(baseline.rating);
                      setRec(baseline.rec);
                      setTryAgain(baseline.tryAgain);
                      if (clip) URL.revokeObjectURL(clip.url);
                      setClip(null);
                      setRemoveStored(false);
                      setError(null);
                      setEditing(false);
                    }}
                    className={buttonClass("ghost", "md", "w-full")}
                  >
                    Cancel
                  </button>
                ) : null}
                <p className="text-center text-[12px] font-semibold text-muted">
                  <kbd className="font-sans font-extrabold">⌘/Ctrl + Enter</kbd> saves
                </p>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex gap-3 rounded-b-[22px] border-t-2 border-soft bg-[#f8f9fe] px-6 py-4">
          <Info size={18} weight="bold" className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="text-[13px] font-semibold leading-relaxed text-ink/75">
            The AI feedback is a practice aid. <span className="font-extrabold text-ink">Your judgment is the authority</span>: what you save
            here is what {learnerFirst} sees as their trainer&apos;s review, alongside the AI notes.
          </p>
        </div>
      </div>
    </aside>
  );
}

function ReviewSummary({
  feedback,
  hasAudio,
  audioUrl,
  rating,
  recDetail,
  tryAgain,
  learnerFirst,
}: {
  feedback: string;
  hasAudio: boolean;
  audioUrl: string | null;
  rating: string | null;
  recDetail: { label: string; title: string; sub: string } | null;
  tryAgain: boolean;
  learnerFirst: string;
}) {
  const level = RATINGS.find((r) => r.id === rating);
  return (
    <dl className="grid gap-4">
      {feedback.trim() ? (
        <div>
          <dt className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Written</dt>
          <dd className="mt-1.5 whitespace-pre-line text-[15px] font-semibold leading-relaxed text-ink">{feedback}</dd>
        </div>
      ) : null}
      {hasAudio && audioUrl ? (
        <div>
          <dt className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Voice note</dt>
          <dd className="mt-1.5">
            <Player src={audioUrl} label="Your voice note" />
          </dd>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div>
          <dt className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Level</dt>
          <dd className="mt-1">{level ? <Badge tone="primary">{level.label}</Badge> : <span className="text-[14px] font-bold text-muted">Not set</span>}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Try again</dt>
          <dd className="mt-1 text-[14px] font-bold text-ink">{tryAgain ? `Yes, ${learnerFirst} will see it` : "No"}</dd>
        </div>
      </div>
      {recDetail ? (
        <div>
          <dt className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Recommended next</dt>
          <dd className="mt-1.5 rounded-2xl bg-soft px-4 py-3">
            <p className="text-[12px] font-extrabold text-primary-shadow">{recDetail.label}</p>
            <p className="text-[14px] font-extrabold text-ink">{recDetail.title}</p>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
