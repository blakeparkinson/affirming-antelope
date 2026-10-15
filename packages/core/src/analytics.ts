// Analytics vocabulary, shared by the website, the trainer dashboard and the learner app.
// The contract is docs/tracking-plan.md; change the two together.
//
// Privacy rule (non-negotiable): properties are ids, enums, numbers and booleans only.
// Never transcript text, learner replies, reflections, notes, trainer feedback, emails
// or names. The types below make that hard to get wrong: there is no `string` property
// that could hold free text, only unions and content ids.

import type { ReminderKind } from "./reminders";
import type { PathwayId, SkillId, SkillLevelNumber } from "./types";

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export type AnalyticsSurface = "website" | "app" | "trainer";
export type AnalyticsPlatform = "web" | "ios" | "android";
export type AudienceId = "clinicians" | "leaders" | "trainers";

/** Where a CTA sits. `audience_<x>` and `guide_<slug>` are open-ended by design. */
export type CtaLocation =
  | "hero"
  | "nav"
  | "download_band"
  | "footer"
  | "trainer_pilot"
  | "faq"
  | "about"
  | "scenarios"
  | `scenario_${string}`
  | `audience_${string}`
  | `guide_${string}`;

/** Where a CTA goes: the learner app, the trainer dashboard, or the pilot booking page. */
export type CtaTarget = "app" | "trainer" | "pilot";
export const CTA_TARGETS: readonly CtaTarget[] = ["app", "trainer", "pilot"];

export type PracticeKind = "drill" | "roleplay" | "lesson";
export type PracticeSource =
  | "today"
  | "assignment"
  | "path"
  | "practice_tab"
  | "challenge"
  | "guide"
  | "review_recommendation"
  | "next_step"
  /** Home's "Keep it sharp" card: a faded skill's refresh. */
  | "refresh";

/** Where reminders were turned on or declined: the completion-screen offer, or Me › Reminders. */
export type ReminderSource = "offer" | "me";
/** Where the daily rep was started: Home's card, or a tapped reminder. */
export type DailyRepEntry = "home" | "reminder" | "recap";
export type SignInReason = "welcome" | "cohort" | "review" | "me" | "quota";
export type AppEntry = "direct" | "website_cta" | "guide" | "deep_link";
export type NextStepFrom = "drill" | "debrief" | "lesson";
export type NextStepChoice = "try_again" | "same_skill" | "harder" | "new_scenario" | "one_more" | "done";
export type AiEndpoint = "turn" | "debrief" | "drill";
/** How the learner answered: typed, or spoken (role-play Talk mode, docs/voice.md). */
export type PracticeMode = "text" | "voice";
/** Why a spoken turn didn't become a transcript. */
export type VoiceFailReason = "no_speech" | "permission" | "unavailable" | "rate_limited" | "too_large" | "offline" | "server";
/** Self-reported feeling after a role-play: an enum from the reflection step, never text. */
export type ReflectionFeeling = string;
export type ReviewRating = "emerging" | "developing" | "proficient" | "strong";
/** "About how many learners" on the trainer access request (a bucket, never a count typed in). */
export type TrainerLearnerCount = "1-10" | "11-30" | "31-100" | "100+";

// ---------------------------------------------------------------------------
// Event map: name -> properties
// ---------------------------------------------------------------------------

export interface AnalyticsEvents {
  // Website
  cta_clicked: { location: CtaLocation; target: CtaTarget; audience?: AudienceId };
  guide_drill_clicked: { slug: string; drill_id: string };

  // Learner app
  app_opened: { entry: AppEntry; src?: string };
  onboarding_chosen: { choice: "guest" | "sign_in" };
  sign_in_started: { reason: SignInReason };
  sign_in_completed: { is_new_user: boolean; migrated_guest_data: boolean };
  signed_out: undefined;
  practice_started: {
    kind: PracticeKind;
    ref_id: string;
    skill?: SkillId;
    level?: SkillLevelNumber;
    source: PracticeSource;
    /** The learner's active track when it happened. */
    pathway_id: PathwayId;
    mode: PracticeMode;
  };
  drill_answered: {
    drill_id: string;
    skill: SkillId;
    level: SkillLevelNumber;
    format: "choice" | "text";
    hit_target: boolean;
  };
  drill_feedback_received: { drill_id: string; latency_ms: number; move: string; hit_target: boolean };
  roleplay_turn_sent: { scenario_id: string; turn_index: number };
  /** A spoken turn was sent for transcription (never the audio or the words). */
  voice_turn_recorded: { scenario_id: string; duration_ms: number };
  voice_transcribe_failed: { reason: VoiceFailReason };
  roleplay_ended: { scenario_id: string; learner_turns: number; ended_early: boolean };
  reflection_submitted: { scenario_id: string; feeling: ReflectionFeeling };
  debrief_viewed: { scenario_id: string; latency_ms: number; suggested_next_step: string; pathway_id: PathwayId };
  next_step_chosen: { from: NextStepFrom; choice: NextStepChoice };
  practice_completed: {
    kind: PracticeKind;
    ref_id: string;
    skill?: SkillId;
    minutes: number;
    activity_id?: string;
    in_course: boolean;
    pathway_id: PathwayId;
  };
  streak_extended: { streak_days: number };
  /** A practice took the streak across a milestone (3, 7, 14, 30, 50, 100) and the full-screen moment queued. Once per milestone per run, across devices. */
  streak_milestone_reached: { milestone: number; streak_days: number };
  weekly_goal_hit: { target: number };
  /** A freeze covered missed days. `saved`: false when a later missed day broke the streak anyway. */
  streak_freeze_used: { freezes_used: number; freezes_held: number; streak_days: number; saved: boolean };
  /** Hitting the weekly goal earned a freeze. `at_cap`: already holding 2, so it was wasted. */
  streak_freeze_earned: { freezes_held: number; at_cap: boolean };
  /** The completion screen offered practice reminders (`ask` 1 after the first practice, 2 after the third). */
  reminder_prompt_shown: { ask: number };
  reminder_opt_in: { source: ReminderSource; hour: number; minute: number };
  reminder_declined: { source: ReminderSource; reason: "not_now" | "permission_denied" };
  reminder_opened: { kind: ReminderKind };
  reminder_settings_changed: { on: boolean; hour: number; minute: number };
  /** Home showed last week's recap (once a week, on the first device to open). `empty`: no practice that week, the fresh-start version. */
  weekly_recap_shown: { week_start: string; empty: boolean; days_practiced: number; reps: number; has_roleplay: boolean; has_line: boolean };
  /** The recap's "Start this week" (opens the daily rep), or a dismissal. */
  weekly_recap_cta: { week_start: string; action: "start" | "dismiss"; empty: boolean };
  /** Home showed the daily rep card. `done`: today's rep was already practiced (the card offers one more). */
  daily_rep_shown: { drill_id: string; skill: SkillId; done: boolean; pathway_id: PathwayId };
  /** The learner started the daily rep. `one_more`: a further drill after today's rep was done. */
  daily_rep_started: { drill_id: string; skill: SkillId; entry: DailyRepEntry; one_more: boolean; pathway_id: PathwayId };
  /**
   * Home showed the "Keep it sharp" card for a faded skill (`sharpness.ts`). `sharpness` is 0..1 to
   * two places, `days` whole days since the skill was last practised, `faded` how many skills are faded.
   */
  skill_faded_shown: { skill: SkillId; level: SkillLevelNumber; sharpness: number; days: number; faded: number };
  /** The learner practised a skill that was faded, which restores it. `sharpness` is the value before. */
  skill_refreshed: { skill: SkillId; level: SkillLevelNumber; sharpness: number; days: number; kind: PracticeKind };
  cohort_joined: { cohort_id: string };
  /** The learner picked (or switched) their track. */
  pathway_chosen: { pathway_id: PathwayId; source: "onboarding" | "me" | "cohort" };
  submission_created: { kind: "roleplay" | "drill"; ref_id: string };
  submission_withdrawn: undefined;
  review_viewed: { rating?: ReviewRating; has_audio: boolean; try_again: boolean };
  ai_request_failed: { endpoint: AiEndpoint; status: number };

  // Trainer dashboard
  trainer_signed_in: { is_new_user: boolean };
  trainer_access_claimed: undefined;
  /** Sent a "Request trainer access" form. Never the name, organization or note. */
  trainer_access_requested: { request_id: string; learner_count: TrainerLearnerCount };
  /** An admin approved a request at /trainer/admin. */
  trainer_access_approved: { request_id: string };
  cohort_created: undefined;
  join_code_copied: undefined;
  assignment_created: { item_count: number; kinds: string[]; due_in_days?: number };
  review_opened: { hours_since_submitted: number };
  review_saved: {
    rating?: ReviewRating;
    has_audio: boolean;
    has_recommendation: boolean;
    try_again: boolean;
    is_edit: boolean;
  };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Properties argument: omitted entirely for events that carry none (typed `undefined` in the map). */
export type AnalyticsArgs<E extends AnalyticsEventName> = undefined extends AnalyticsEvents[E]
  ? [props?: undefined]
  : [props: AnalyticsEvents[E]];

/**
 * The one signature every surface implements (posthog-js on the web, posthog-react-native
 * in the app). With no key, or with Do Not Track / Global Privacy Control set, it's a no-op.
 */
export type TrackFn = <E extends AnalyticsEventName>(name: E, ...args: AnalyticsArgs<E>) => void;

// ---------------------------------------------------------------------------
// Super and person properties
// ---------------------------------------------------------------------------

/** Registered once; PostHog attaches them to every event. */
export interface AnalyticsSuperProps {
  surface: AnalyticsSurface;
  platform: AnalyticsPlatform;
  app_version?: string;
  signed_in?: boolean;
}

/** Set on the identified person (signed-in only). The distinct id is the Supabase user uuid. */
export interface AnalyticsPersonProps {
  role: "learner" | "trainer";
  is_trainer: boolean;
  cohort_count?: number;
  /** ISO date. */
  signed_up_at?: string;
  /** The learner's active track. */
  pathway_id?: PathwayId;
}

/** Query params a CTA appends so the app can continue the visitor's anonymous identity. */
export const ANALYTICS_BRIDGE_PARAMS = { distinctId: "ph_did", sessionId: "ph_sid", src: "src" } as const;

/** Origin of the learner app; links to it get the bridge params. */
export const APP_ORIGIN = "https://app.affirmingantelope.com";

/** Default first-party ingest host for the app (the website proxies it to PostHog). */
export const DEFAULT_APP_INGEST_HOST = "https://affirmingantelope.com/ingest";

// ---------------------------------------------------------------------------
// Defence in depth
// ---------------------------------------------------------------------------

/** Longest string a property may carry. Ids, slugs and enums are far shorter; prose is not. */
export const MAX_PROP_STRING = 64;

/**
 * Drops anything that could be free text before it leaves the device: strings longer than
 * MAX_PROP_STRING, nested objects, and arrays of anything but short strings or numbers.
 * The event types already forbid this; the scrub backstops a careless `as any`.
 */
export function scrubProps(props: object | undefined): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      if (value.length <= MAX_PROP_STRING) out[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string" && v.length <= MAX_PROP_STRING)) {
      out[key] = value as string[];
    }
  }
  return out;
}
