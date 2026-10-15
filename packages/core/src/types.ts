// Shared contract between the mobile app, the AI API routes, and (later) the
// trainer dashboard. Content files and prompts build on these types; change
// them deliberately because every workspace depends on them.

// ---------------------------------------------------------------------------
// Skills and progression
// ---------------------------------------------------------------------------

export type SkillId =
  | "oars"
  | "engaging"
  | "focusing"
  | "evoking"
  | "planning"
  | "change-talk"
  | "sustain-talk"
  | "discord"
  | "leadership"
  | "full-conversation";

export interface Skill {
  id: SkillId;
  name: string;
  /** One line, coach voice. */
  tagline: string;
}

/** Skill levels replace scores. Each skill climbs Recognize -> Advanced. */
export type SkillLevelNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface SkillLevel {
  level: SkillLevelNumber;
  name: "Recognize" | "Respond" | "Elicit" | "Sustain" | "Integrate" | "Advanced";
  /** The question the level answers, e.g. "Can you identify change talk?" */
  question: string;
}

// ---------------------------------------------------------------------------
// Course path (the 12-week MI for Leaders pathway)
// ---------------------------------------------------------------------------

export type ActivityKind = "learn" | "drill" | "roleplay";

export interface PathActivity {
  id: string;
  kind: ActivityKind;
  title: string;
  minutes: number;
  /** For drills: Drill ids. For roleplays: a ScenarioSpec id. */
  refIds?: string[];
}

export interface PathUnit {
  week: number;
  id: string;
  title: string;
  /** Short coach-voice line shown on the path node. */
  subtitle: string;
  skills: SkillId[];
  activities: PathActivity[];
}

/**
 * Where a conversation happens. Drives the counterpart's label ("Employee" vs
 * "Patient"), the learner's role, and which pathway content belongs to.
 */
export type Setting = "workplace" | "clinical";

/**
 * Who is talking to whom in one scenario. Usually the scenario's setting; a
 * scenario can set its own `frame` (a coach and an athlete) while its setting
 * still decides which pathway it belongs to.
 */
export type Frame = Setting | "sports";

export type PathwayId = "mi-for-leaders" | "mi-for-clinicians";

export interface Pathway {
  id: PathwayId;
  title: string;
  setting: Setting;
  /** One line for pickers, e.g. "Performance, change, and burnout conversations with your team." */
  tagline: string;
  /** Who it's for, e.g. "Managers and team leads in healthcare". */
  audience: string;
  units: PathUnit[];
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  /** Short cards, swiped through. Plain text, no markdown. */
  cards: { heading: string; body: string; example?: string }[];
}

// ---------------------------------------------------------------------------
// Scenario engine
// ---------------------------------------------------------------------------

export type Difficulty = "intro" | "intermediate" | "advanced";

/** Where the employee sits in the conversation at a moment in time. */
export type Stance = "sustain" | "ambivalent" | "change" | "discord";

export interface Persona {
  name: string;
  role: string;
  tenure: string;
  /** Used by the app to render a consistent illustrated avatar. */
  avatarSeed: string;
  /** How they talk: pace, vocabulary, tells. For the role-player only. */
  voiceNotes: string;
  /**
   * How the persona sounds when spoken aloud (docs/voice.md). `openai` is a built-in
   * OpenAI voice id; `instructions` is style direction (age, pace, warmth, guardedness)
   * for the speech model. Server-side only: the client never chooses the voice.
   */
  voice?: { openai: string; instructions: string };
}

export interface ScenarioSpec {
  id: string; // e.g. "PM-017"
  title: string;
  /** Pathway membership. Also the labels and prompt wording, unless `frame` is set. */
  setting: Setting;
  /**
   * Optional. Overrides the labels and prompt wording (counterpart, learner role,
   * setting-specific prompt lines) without moving the scenario out of its
   * setting's pathway. Read it through scenarioFrame / scenarioLabels.
   */
  frame?: "sports";
  context: string; // e.g. "Performance management", "Primary care follow-up"
  issue: string; // workplace: "Missed deadlines"; clinical: "Blood pressure medication adherence"
  /**
   * Optional. The behavior change talk is judged against, when it's more
   * specific than `issue` (e.g. "Cutting back on drinking"). Defaults to issue.
   */
  targetBehavior?: string;
  persona: Persona;
  /** What the learner sees before starting. Coach voice, second person. */
  learnerBrief: string;
  /** The learner's goal for this conversation, one sentence. */
  learnerGoal: string;
  /** The employee's first line; the app shows it without an API call. */
  openingLine: string;
  employeeMotivation: "low" | "mixed" | "high";
  primaryChallenge: SkillId;
  secondaryChallenge?: SkillId;
  targetSkills: SkillId[];
  notRequired: SkillId[];
  difficulty: Difficulty;
  desiredTrajectory: Stance[];
  /** Role-player only. Never shown to the learner. */
  hiddenBackstory: string;
  /** Learner behaviors that should move the employee toward change. */
  changeTriggers: string[];
  /** Learner behaviors that should entrench sustain talk or create discord. */
  sustainTriggers: string[];
  /** Ids of an easier and harder variant, for "Try a harder scenario". */
  easierId?: string;
  harderId?: string;
}

// ---------------------------------------------------------------------------
// Conversation and analysis
// ---------------------------------------------------------------------------

export interface Turn {
  id: string;
  /**
   * "employee" is the stored id for the role-played counterpart in every setting
   * (an employee at work, a patient in clinic). Never show it to people: label
   * it with scenarioCounterpartLabel(spec), or counterpartLabel(setting) for drills.
   */
  speaker: "learner" | "employee";
  text: string;
}

/** MITI-informed behavior codes for learner turns. */
export type LearnerMove =
  | "open-question"
  | "closed-question"
  | "simple-reflection"
  | "complex-reflection"
  | "affirmation"
  | "summary"
  | "giving-information"
  | "advice-with-permission"
  | "emphasize-autonomy"
  | "seeking-collaboration"
  | "advice-without-permission"
  | "confront"
  | "other";

export type ClientTalk = "change" | "sustain" | "neutral";

export interface TurnAnnotation {
  turnId: string;
  speaker: Turn["speaker"];
  /** Learner turns only. */
  move?: LearnerMove;
  /** Employee turns only. */
  talk?: ClientTalk;
  /** Employee turns only. -2 strong sustain/discord ... +2 strong change. */
  intensity?: -2 | -1 | 0 | 1 | 2;
  stance?: Stance;
  /** Short observation, e.g. "Reflected the feeling under the complaint." */
  note?: string;
}

/** "One possible MI-consistent response" — never "the correct response". */
export interface KeyMoment {
  turnId: string;
  observation: string;
  possibleResponses: string[]; // 2-3 options
  why: string;
}

export interface SelfReflection {
  /** How the learner felt it went, before seeing AI feedback. */
  feeling: "rough" | "mixed" | "solid";
  text: string;
}

export type NextStep = "try-again" | "same-skill" | "harder" | "new-scenario";

export interface MoveTallies {
  openQuestions: number;
  closedQuestions: number;
  simpleReflections: number;
  complexReflections: number;
  affirmations: number;
  summaries: number;
  /** Emphasizing autonomy, seeking collaboration, advice with permission. */
  autonomySupport: number;
  miInconsistent: number;
}

/** Output of Observer (annotations, tallies) + Coach (everything else). */
export interface Debrief {
  annotations: TurnAnnotation[];
  tallies: MoveTallies;
  /** Employee intensity per employee turn, in order; drives the replay chart. */
  trajectory: number[];
  /** Coach responds to the learner's own reflection first. */
  reflectionResponse: string;
  strengths: string[];
  keyMoments: KeyMoment[];
  tryNext: string;
  suggestedNextStep: NextStep;
}

// ---------------------------------------------------------------------------
// Daily drills
// ---------------------------------------------------------------------------

export interface Drill {
  id: string;
  setting: Setting;
  skill: SkillId;
  level: SkillLevelNumber;
  /** Setting line, e.g. "A team lead, after a missed deadline". */
  context: string;
  speaker: string; // "Employee", "Direct report", "Patient", ...
  prompt: string; // what they say
  /** What to try, e.g. "Respond with a complex reflection." */
  instruction: string;
  /** For the Recognize level: multiple choice instead of free text. */
  choices?: { text: string; isTarget: boolean; explanation: string }[];
  exampleResponses: string[];
}

export interface DrillFeedback {
  move: LearnerMove;
  /** Did the attempt do what the instruction asked? Not a grade. */
  hitTarget: boolean;
  observation: string;
  strength?: string;
  possibleResponses: string[];
  tryNext: string;
}

// ---------------------------------------------------------------------------
// API contract (apps/web route handlers)
// ---------------------------------------------------------------------------

/** POST /api/roleplay/turn -> text/plain stream of the employee's reply. */
export interface RoleplayTurnRequest {
  scenarioId: string;
  turns: Turn[];
}

/** POST /api/roleplay/debrief -> Debrief */
export interface RoleplayDebriefRequest {
  scenarioId: string;
  turns: Turn[];
  selfReflection: SelfReflection;
}

/** POST /api/drill/feedback -> DrillFeedback */
export interface DrillFeedbackRequest {
  drillId: string;
  response: string;
}

// ---------------------------------------------------------------------------
// Setting labels (UI copy and prompts read these; never hard-code "employee")
// ---------------------------------------------------------------------------

export interface FrameLabels {
  counterpart: string;
  counterparts: string;
  learnerRole: string;
  conversation: string;
}

/** Setting-level nouns: pathways, drills, empty states. For one scenario, use scenarioLabels. */
export const SETTING_LABELS: Record<Setting, FrameLabels> = {
  workplace: { counterpart: "employee", counterparts: "employees", learnerRole: "manager", conversation: "one-on-one" },
  clinical: { counterpart: "patient", counterparts: "patients", learnerRole: "clinician", conversation: "visit" },
};

/** Nouns per frame: the settings, plus frames a scenario can opt into. */
export const FRAME_LABELS: Record<Frame, FrameLabels> = {
  ...SETTING_LABELS,
  sports: { counterpart: "athlete", counterparts: "athletes", learnerRole: "coach", conversation: "check-in" },
};

/** The scenario's frame: its own `frame` when set, else its setting. */
export function scenarioFrame(spec: Pick<ScenarioSpec, "setting" | "frame">): Frame {
  return spec.frame ?? spec.setting;
}

/** Nouns for one scenario ("athlete" and "coach" for a sports scenario in the leaders pathway). */
export function scenarioLabels(spec: Pick<ScenarioSpec, "setting" | "frame">): FrameLabels {
  return FRAME_LABELS[scenarioFrame(spec)];
}

/** "Employee" / "Patient" / "Athlete", sentence case for UI labels. Takes a setting or a frame. */
export function counterpartLabel(frame: Frame): string {
  const w = FRAME_LABELS[frame].counterpart;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** The counterpart label for one scenario, following its frame. */
export function scenarioCounterpartLabel(spec: Pick<ScenarioSpec, "setting" | "frame">): string {
  return counterpartLabel(scenarioFrame(spec));
}
