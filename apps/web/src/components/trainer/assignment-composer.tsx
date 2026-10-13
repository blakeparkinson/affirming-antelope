"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Trash } from "@phosphor-icons/react";
import { createAssignment } from "@/app/trainer/actions";
import { track } from "@/lib/analytics/client";
import {
  DIFFICULTY,
  catalogFor,
  counterpartOf,
  dueLabel,
  itemDetail,
  itemTitle,
  skillName,
  summarizeItems,
  type ItemDraft,
} from "@/lib/trainer/content";
import type { SkillId } from "@antelope/core";
import { ItemIcon } from "./item-icon";
import { Badge, buttonClass, focusRing } from "./ui";
import { fieldClass, hintClass, labelClass } from "./fields";

type Mode = "skill" | "drill" | "roleplay" | "learn";

/** Tab copy follows the cohort's pathway: the role-play is with an AI patient or a simulated employee. */
function modesFor(catalog: { pathwayTitle: string; setting: "workplace" | "clinical" }): { id: Mode; label: string; hint: string }[] {
  return [
    { id: "skill", label: "Drills on a skill", hint: "Any N short practices on one skill. Learners pick which." },
    { id: "drill", label: "A specific drill", hint: "One exact prompt everyone answers." },
    {
      id: "roleplay",
      label: "An AI role-play",
      hint: `A full practice conversation with an AI ${counterpartOf(catalog.setting).toLowerCase()}.`,
    },
    { id: "learn", label: "A pathway lesson", hint: `A short card lesson from ${catalog.pathwayTitle}.` },
  ];
}

type Keyed = ItemDraft & { key: string };

const DIFF_TONE = { intro: "teal", intermediate: "primary", advanced: "clay" } as const;

/** A due date (yyyy-mm-dd) means 5pm local time that day. */
function dueIso(date: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T17:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function AssignmentComposer({
  cohortId,
  pathwayId,
  trainerName,
  defaultDue,
}: {
  cohortId: string;
  pathwayId: string;
  trainerName: string;
  defaultDue: string;
}) {
  const catalog = useMemo(() => catalogFor(pathwayId), [pathwayId]);
  const MODES = useMemo(() => modesFor(catalog), [catalog]);
  const firstSkill: SkillId = catalog.drillSkills.includes("evoking") ? "evoking" : (catalog.drillSkills[0] ?? "evoking");
  const router = useRouter();
  const reduce = useReducedMotion();
  const uid = useId();
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState(defaultDue);
  const [items, setItems] = useState<Keyed[]>([]);
  const [mode, setMode] = useState<Mode>("skill");
  const [skill, setSkill] = useState<SkillId>(firstSkill);
  const [qty, setQty] = useState(2);
  const [drillSkill, setDrillSkill] = useState<SkillId | "all">(firstSkill);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const drills = useMemo(
    () => catalog.drills.filter((d) => drillSkill === "all" || d.skill === drillSkill),
    [catalog, drillSkill],
  );
  // "Any N drills" only counts this pathway's drills, so N can't exceed what exists on the skill.
  const skillDrills = catalog.drillCounts[skill] ?? 0;
  const maxQty = Math.max(1, Math.min(10, skillDrills));
  const summary = summarizeItems(items);
  const dueText = dueLabel(dueIso(due));

  const pickReady =
    mode === "skill" ? true : mode === "drill" ? !!drillId : mode === "roleplay" ? !!scenarioId : !!lessonId;

  function add() {
    let draft: ItemDraft | null = null;
    if (mode === "skill") draft = { kind: "any-drill", refId: null, skill, quantity: qty };
    if (mode === "drill" && drillId) draft = { kind: "drill", refId: drillId, skill: null, quantity: 1 };
    if (mode === "roleplay" && scenarioId) draft = { kind: "roleplay", refId: scenarioId, skill: null, quantity: 1 };
    if (mode === "learn" && lessonId) draft = { kind: "learn", refId: lessonId, skill: null, quantity: 1 };
    if (!draft) return;
    const d = draft;
    // Same any-drill skill twice: merge quantities instead of a duplicate row.
    const dup = items.find((i) => i.kind === d.kind && i.refId === d.refId && i.skill === d.skill);
    if (dup) {
      if (d.kind === "any-drill") {
        setItems((xs) => xs.map((x) => (x.key === dup.key ? { ...x, quantity: Math.min(10, x.quantity + d.quantity) } : x)));
        setAnnounce(`Updated: ${itemTitle({ ...dup, quantity: Math.min(10, dup.quantity + d.quantity) })}`);
      } else setAnnounce(`${itemTitle(d)} is already on this assignment.`);
      return;
    }
    seq.current += 1;
    setItems((xs) => [...xs, { ...d, key: `i${seq.current}` }]);
    setAnnounce(`Added: ${itemTitle(d)}`);
    setError(null);
  }

  function move(key: string, dir: -1 | 1) {
    setItems((xs) => {
      const i = xs.findIndex((x) => x.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= xs.length) return xs;
      const out = [...xs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Give the assignment a title.");
    if (!items.length) return setError("Add at least one practice.");
    start(async () => {
      const res = await createAssignment({
        cohortId,
        title,
        instructions,
        dueAt: dueIso(due),
        items: items.map(({ kind, refId, skill, quantity }) => ({ kind, refId, skill, quantity })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Counts and kinds only: never the title, instructions, or any text the trainer wrote.
      const dueAt = dueIso(due);
      track("assignment_created", {
        item_count: items.length,
        kinds: [...new Set(items.map((i) => i.kind))],
        ...(dueAt ? { due_in_days: Math.max(0, Math.round((Date.parse(dueAt) - Date.now()) / 86_400_000)) } : {}),
      });
      router.push(`/trainer/cohorts/${cohortId}/assignments?created=${res.data.id}`);
    });
  }

  function onTabKey(e: React.KeyboardEvent, idx: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (idx + dir + MODES.length) % MODES.length;
    setMode(MODES[next].id);
    tabRefs.current[next]?.focus();
  }

  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
      }}
      className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]"
      aria-describedby={`${uid}-kbd`}
    >
      <div className="grid min-w-0 gap-8">
        {/* Basics */}
        <fieldset className="grid gap-5 rounded-[20px] border-2 border-line bg-white p-6 shadow-[0_5px_0_var(--shadow)]">
          <legend className="sr-only">Basics</legend>
          <div>
            <label htmlFor={`${uid}-title`} className={labelClass}>
              Title
            </label>
            <input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Week 6: Responding to sustain talk"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-instr`} className={labelClass}>
              Instructions <span className="font-semibold text-muted">(optional)</span>
            </label>
            <textarea
              id={`${uid}-instr`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="What to focus on, and why it matters this week."
              className={`${fieldClass} resize-y leading-relaxed`}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={`${uid}-due`} className={labelClass}>
                Due date
              </label>
              <input id={`${uid}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${fieldClass} w-[200px]`} />
            </div>
            <p className={`${hintClass} pb-3`}>{due ? `${dueText}, 5pm your time.` : "No due date: it stays open."}</p>
          </div>
        </fieldset>

        {/* Picker */}
        <section aria-labelledby={`${uid}-add`} className="rounded-[20px] border-2 border-line bg-white shadow-[0_5px_0_var(--shadow)]">
          <div className="px-6 pt-5">
            <h3 id={`${uid}-add`} className="font-display text-[19px] font-bold text-ink">
              Add practice
            </h3>
            <p className="mt-1 text-[14px] font-semibold text-muted">Everything here comes from the {catalog.pathwayTitle} library.</p>
          </div>
          <div role="tablist" aria-label="Kind of practice" className="mt-4 flex flex-wrap gap-2 px-6">
            {MODES.map((m, idx) => (
              <button
                key={m.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${m.id}`}
                aria-selected={mode === m.id}
                aria-controls={`${uid}-panel`}
                tabIndex={mode === m.id ? 0 : -1}
                onClick={() => setMode(m.id)}
                onKeyDown={(e) => onTabKey(e, idx)}
                className={`relative rounded-xl px-3.5 py-2 text-[14px] font-extrabold transition-colors ${focusRing} ${mode === m.id ? "text-white" : "bg-soft text-ink/80 hover:bg-soft-deep"}`}
              >
                {mode === m.id ? (
                  <motion.span
                    layoutId={`${uid}-mode`}
                    className="absolute inset-0 -z-0 rounded-xl bg-navy"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                  />
                ) : null}
                <span className="relative">{m.label}</span>
              </button>
            ))}
          </div>

          <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className="px-6 pt-5 pb-6">
            <p className="text-[14px] font-semibold text-muted">{MODES.find((m) => m.id === mode)?.hint}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode} {...fade} transition={{ duration: 0.16 }} className="mt-4">
                {mode === "skill" ? (
                  <div className="grid gap-5">
                    <fieldset>
                      <legend className={labelClass}>Skill</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {catalog.drillSkills.map((s) => (
                          <label
                            key={s}
                            className="cursor-pointer rounded-xl border-2 border-line bg-white px-3 py-1.5 text-[14px] font-extrabold text-ink/80 transition-colors hover:border-primary-tint has-[:checked]:border-primary has-[:checked]:bg-primary-tint/40 has-[:checked]:text-primary-shadow has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary/40"
                          >
                            <input
                              type="radio"
                              name={`${uid}-skill`}
                              value={s}
                              checked={skill === s}
                              onChange={() => {
                                setSkill(s);
                                setQty((q) => Math.min(q, Math.max(1, Math.min(10, catalog.drillCounts[s] ?? 0))));
                              }}
                              className="sr-only"
                            />
                            {skillName(s)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <span className={labelClass} id={`${uid}-qty`}>
                        How many
                      </span>
                      <Stepper value={qty} onChange={setQty} min={1} max={maxQty} labelledBy={`${uid}-qty`} unit={qty === 1 ? "practice" : "practices"} />
                      <p className={hintClass}>
                        Learners choose from the {skillDrills} {skillName(skill)} {skillDrills === 1 ? "drill" : "drills"} in {catalog.pathwayTitle}.
                      </p>
                    </div>
                  </div>
                ) : null}

                {mode === "drill" ? (
                  <div className="grid gap-4">
                    <div>
                      <label htmlFor={`${uid}-dskill`} className={labelClass}>
                        Skill
                      </label>
                      <select
                        id={`${uid}-dskill`}
                        value={drillSkill}
                        onChange={(e) => {
                          setDrillSkill(e.target.value as SkillId | "all");
                          setDrillId(null);
                        }}
                        className={`${fieldClass} w-[260px]`}
                      >
                        <option value="all">All skills</option>
                        {catalog.drillSkills.map((s) => (
                          <option key={s} value={s}>
                            {skillName(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <fieldset>
                      <legend className="sr-only">Drill</legend>
                      <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-1">
                        {drills.map((d) => (
                          <ChoiceCard key={d.id} name={`${uid}-drill`} value={d.id} checked={drillId === d.id} onChange={() => setDrillId(d.id)}>
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-[14px] font-extrabold text-ink">{d.instruction}</span>
                              <Badge>{skillName(d.skill)} · Level {d.level}</Badge>
                            </span>
                            <span className="mt-1 block text-[13px] font-semibold text-muted">{d.context}</span>
                            <span className="mt-1.5 block text-[14px] font-semibold italic text-ink/80">“{d.prompt}”</span>
                          </ChoiceCard>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                ) : null}

                {mode === "roleplay" ? (
                  <fieldset>
                    <legend className="sr-only">Role-play scenario</legend>
                    <div className="grid gap-2">
                      {catalog.scenarios.map((s) => (
                        <ChoiceCard key={s.id} name={`${uid}-scenario`} value={s.id} checked={scenarioId === s.id} onChange={() => setScenarioId(s.id)}>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-[17px] font-bold text-ink">{s.title}</span>
                            <Badge tone={DIFF_TONE[s.difficulty]}>{DIFFICULTY[s.difficulty]}</Badge>
                            <Badge>{skillName(s.skill)}</Badge>
                          </span>
                          <span className="mt-1 block text-[13px] font-bold text-muted">
                            {s.persona} · {s.context}: {s.issue}
                          </span>
                          <span className={`mt-2 block text-[14px] font-semibold leading-relaxed text-ink/80 ${scenarioId === s.id ? "" : "line-clamp-2"}`}>
                            {s.brief}
                          </span>
                          {scenarioId === s.id ? (
                            <span className="mt-2 block text-[13px] font-bold text-primary-shadow">Goal: {s.goal}</span>
                          ) : null}
                        </ChoiceCard>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {mode === "learn" ? (
                  <fieldset>
                    <legend className="sr-only">Lesson</legend>
                    <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-1">
                      {catalog.lessons.map((l) => (
                        <ChoiceCard key={l.id} name={`${uid}-lesson`} value={l.id} checked={lessonId === l.id} onChange={() => setLessonId(l.id)}>
                          <span className="text-[14px] font-extrabold text-ink">{l.title}</span>
                          <span className="mt-0.5 block text-[13px] font-semibold text-muted">
                            Week {l.week} · {l.unitTitle}
                          </span>
                        </ChoiceCard>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </motion.div>
            </AnimatePresence>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={add} disabled={!pickReady} className={buttonClass("secondary")}>
                <Plus size={16} weight="bold" aria-hidden /> Add to assignment
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Preview + items */}
      <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:sticky xl:top-6" aria-label="Assignment preview">
        <div className="rounded-[24px] border-2 border-line bg-soft p-5 shadow-[0_5px_0_var(--shadow)]">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">What learners will see</p>
          <div className="mt-3 rounded-[20px] border-2 border-line bg-white p-5 shadow-[0_4px_0_var(--shadow)]">
            <p className="text-[12px] font-extrabold text-muted">From {trainerName}</p>
            <p className="mt-1 font-display text-[19px] font-bold leading-tight text-ink">{title.trim() || "Untitled assignment"}</p>
            <p className="mt-1 text-[14px] font-extrabold text-primary-shadow" aria-live="polite">
              {summary ? `${summary} · ${dueText}` : dueText}
            </p>
            {instructions.trim() ? <p className="mt-2 line-clamp-4 whitespace-pre-line text-[14px] font-semibold leading-relaxed text-ink/80">{instructions}</p> : null}

            <LayoutGroup>
              <ol className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Practices on this assignment">
                <AnimatePresence initial={false}>
                  {items.map((i, idx) => (
                    <motion.li
                      key={i.key}
                      layout={!reduce}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="group rounded-2xl border-2 border-soft bg-white p-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <ItemIcon kind={i.kind} size={16} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] leading-snug font-extrabold text-ink">{itemTitle(i)}</p>
                          <p className="truncate text-[12px] font-semibold text-muted">{itemDetail(i)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 border-t-2 border-soft pt-2">
                        {i.kind === "any-drill" ? (
                          <Stepper
                            compact
                            value={i.quantity}
                            min={1}
                            max={10}
                            label={`How many, ${itemTitle(i)}`}
                            onChange={(q) => setItems((xs) => xs.map((x) => (x.key === i.key ? { ...x, quantity: q } : x)))}
                          />
                        ) : null}
                        <span className="flex-1" />
                        <IconButton label={`Move up: ${itemTitle(i)}`} disabled={idx === 0} onClick={() => move(i.key, -1)}>
                          <ArrowUp size={15} weight="bold" />
                        </IconButton>
                        <IconButton label={`Move down: ${itemTitle(i)}`} disabled={idx === items.length - 1} onClick={() => move(i.key, 1)}>
                          <ArrowDown size={15} weight="bold" />
                        </IconButton>
                        <IconButton
                          label={`Remove: ${itemTitle(i)}`}
                          onClick={() => {
                            setItems((xs) => xs.filter((x) => x.key !== i.key));
                            setAnnounce(`Removed: ${itemTitle(i)}`);
                          }}
                        >
                          <Trash size={15} weight="bold" />
                        </IconButton>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </LayoutGroup>
            {!items.length ? (
              <p className="mt-4 rounded-2xl border-2 border-dashed border-line px-4 py-5 text-center text-[14px] font-semibold text-muted">
                Practices you add show up here.
              </p>
            ) : null}
          </div>
        </div>

        <div aria-live="polite" className="sr-only">
          {announce}
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
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
          {pending ? "Publishing…" : "Publish to cohort"}
        </button>
        <p id={`${uid}-kbd`} className="text-center text-[12px] font-semibold text-muted">
          Learners see it right away. <kbd className="font-sans font-extrabold">⌘/Ctrl + Enter</kbd> publishes.
        </p>
      </aside>
    </form>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block cursor-pointer rounded-2xl border-2 px-4 py-3 transition-[border-color,background-color,box-shadow] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary/40 ${
        checked ? "border-primary bg-primary-tint/25 shadow-[0_3px_0_var(--primary-tint)]" : "border-line bg-white hover:border-primary-tint"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  unit,
  labelledBy,
  label,
  compact,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  unit?: string;
  labelledBy?: string;
  label?: string;
  compact?: boolean;
}) {
  const btn = `inline-flex items-center justify-center rounded-xl border-2 border-line bg-white text-ink transition-colors hover:bg-soft disabled:opacity-40 ${focusRing} ${compact ? "h-7 w-7" : "h-10 w-10"}`;
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "mt-2"}`} role="group" aria-labelledby={labelledBy} aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer">
        <Minus size={compact ? 12 : 16} weight="bold" aria-hidden />
      </button>
      <output aria-live="polite" className={`min-w-8 text-center font-display font-bold text-ink ${compact ? "text-[15px]" : "text-[22px]"}`}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">
        <Plus size={compact ? 12 : 16} weight="bold" aria-hidden />
      </button>
      {unit ? <span className="text-[14px] font-bold text-muted">{unit}</span> : null}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label.split(":")[0]}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink disabled:opacity-30 ${focusRing}`}
    >
      {children}
    </button>
  );
}
