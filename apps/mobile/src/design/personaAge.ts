/**
 * Age and setting cues for `Avatar`, read from the content we already have
 * (persona role/tenure, drill context lines, avatar seeds). Pure functions, no React.
 */

export type AvatarAgeBand = 'young' | 'adult' | 'older';
/** A band, or an age in years (bands: under 25 young, 60 and up older). */
export type AvatarAge = AvatarAgeBand | number;
/** A scenario's frame (@antelope/core `Frame`): 'sports' dresses an athlete, 'clinical' a patient. */
export type AvatarSetting = 'workplace' | 'clinical' | 'sports';
/** Steers hair and facial hair only; unset leaves the seed's own mix. */
export type AvatarPresentation = 'feminine' | 'masculine';

const FEM = /\b(she|her|hers|herself|woman|mrs|ms|mother|grandmother|widow|wife)\b/g;
const MASC = /\b(he|him|his|himself|man|mr|father|grandfather|widower|husband)\b/g;

/** Reads pronouns ("she", "his") in persona or drill text. Needs a clear majority, else undefined. */
export function presentationFromText(text: string | undefined | null): AvatarPresentation | undefined {
  if (!text) return undefined;
  const s = text.toLowerCase();
  const f = s.match(FEM)?.length ?? 0;
  const m = s.match(MASC)?.length ?? 0;
  if (f > 0 && f >= 2 * m) return 'feminine';
  if (m > 0 && m >= 2 * f) return 'masculine';
  return undefined;
}

export function ageBand(age: AvatarAge | undefined): AvatarAgeBand {
  if (age === undefined) return 'adult';
  if (typeof age !== 'number') return age;
  if (age < 25) return 'young';
  if (age >= 60) return 'older';
  return 'adult';
}

const plausible = (n: number) => n >= 5 && n <= 110;

const DECADES: Record<string, number> = {
  teens: 15, twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90,
};
const PART: Record<string, number> = { early: 2, mid: 5, late: 8 };

const OLDER_WORDS =
  /\b(retired|retiree|retirement|pensioner|widow(?:ed|er)?|grand(?:mother|father|parent|ma|pa|child|children|kids?|son|daughter)s?|great-grand\w*|medicare|elderly|older adult|senior (?:citizen|center|living|housing)|assisted living|nursing home)\b/;
const YOUNG_WORDS =
  /\b(teen(?:ager)?s?|adolescent|high[- ]school(?:er)?|middle school|college|university|undergrad(?:uate)?|freshman|sophomore|(?:grad(?:uate)?|nursing|medical|college) student|student|campus|dorm|young adult|gap year|first job)\b/;

/**
 * Reads an age from free text: "72-year-old", "age 68", "in her 70s", "late sixties",
 * "Retired teacher, 72", or words like "retired", "grandmother", "college student".
 * Tenure phrases ("19 years on the unit") are ignored. Returns years when stated, else a band.
 */
export function ageFromText(text: string | undefined | null): AvatarAge | undefined {
  if (!text) return undefined;
  const s = text.toLowerCase();
  const num = (m: RegExpMatchArray | null, i = 1) => (m ? Number(m[i]) : NaN);

  let n = num(s.match(/\b(\d{1,3})[\s-]*(?:years?|yrs?)[\s-]*old\b/));
  if (!plausible(n)) n = num(s.match(/\b(?:age|aged|ages)\s*:?\s*(\d{1,3})\b/));
  if (!plausible(n)) n = num(s.match(/\b(\d{1,3})\s*(?:yo|y\/o|y\.o\.)(?![a-z])/));
  if (!plausible(n)) {
    const m = s.match(/\b(?:(early|mid|late)[\s-]*)?(\d)0'?s\b/);
    if (m && Number(m[2]) >= 1) n = Number(m[2]) * 10 + (PART[m[1] ?? 'mid'] ?? 5);
  }
  if (!plausible(n)) {
    const m = s.match(/\b(?:(early|mid|late)[\s-]*)?(teens|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)\b/);
    if (m) n = DECADES[m[2]] + (m[2] === 'teens' ? 2 : PART[m[1] ?? 'mid'] ?? 5);
  }
  // A bare two-digit age set off by punctuation: "Retired bus driver, 72" / "72, retired" / "(72)".
  if (!plausible(n)) n = num(s.match(/(?:^|[,(;]\s*)(\d{2})(?=\s*(?:$|[,);.]))/));
  if (plausible(n)) return n;

  if (OLDER_WORDS.test(s)) return 'older';
  if (YOUNG_WORDS.test(s)) return 'young';
  return undefined;
}

const seedTokens = (seed: string) => seed.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Age cues in an avatar seed shaped "first-last-<cues>": a cue token ("-older", "-senior",
 * "-retired", "-young", "-teen", "-student") or an age ("-age72", "-72yo", or a bare "-72" as
 * the last token). The first two tokens (the name) and `person:` seeds (real people from
 * `personSeed`) are never read, so a surname like "Young" doesn't age anyone, and ids with
 * counters ("drill-oars-12:Employee") don't either.
 */
export function ageFromSeed(seed: string): AvatarAge | undefined {
  if (seed.startsWith('person:')) return undefined;
  const tail = seedTokens(seed).slice(2);
  for (const [i, t] of tail.entries()) {
    const marked = t.match(/^(?:age(\d{1,3})|(\d{1,3})(?:yo|yrs?|years?))$/);
    const bare = i === tail.length - 1 ? t.match(/^(\d{2,3})$/) : null;
    const n = marked ? Number(marked[1] ?? marked[2]) : bare ? Number(bare[1]) : NaN;
    if (plausible(n) && n >= 12) return n;
  }
  for (const t of tail) {
    if (/^(older|old|elder|elderly|senior|retired|retiree|grandma|grandpa|gran|nana)$/.test(t)) return 'older';
    if (/^(young|youth|teen|teenager|student|kid|adolescent)$/.test(t)) return 'young';
    if (t === 'adult') return 'adult';
  }
  return undefined;
}

/** `clinical` when the seed carries a "-patient" token; otherwise unknown. */
export function settingFromSeed(seed: string): AvatarSetting | undefined {
  if (seed.startsWith('person:')) return undefined;
  return seedTokens(seed).includes('patient') ? 'clinical' : undefined;
}

export interface PersonaLike {
  name?: string;
  role: string;
  tenure?: string;
  avatarSeed?: string;
  voiceNotes?: string;
  /** If the content ever states an age outright. */
  age?: number | string;
}

/** Best guess at a persona's age: explicit `age`, then role/tenure text, then seed cues. */
export function personaAge(persona: PersonaLike): AvatarAge | undefined {
  if (typeof persona.age === 'number' && plausible(persona.age)) return persona.age;
  return (
    ageFromText(typeof persona.age === 'string' ? persona.age : undefined) ??
    ageFromText(persona.role) ??
    ageFromText(persona.tenure) ??
    (persona.avatarSeed ? ageFromSeed(persona.avatarSeed) : undefined)
  );
}

export interface AvatarIdentity {
  seed: string;
  age?: AvatarAge;
  setting: AvatarSetting;
  presentation?: AvatarPresentation;
}

/**
 * Props to spread into `<Avatar>` for a scenario persona:
 * `<Avatar {...personaAvatar(sc.persona, sc.setting)} size={56} />`. For a whole scenario,
 * prefer `scenarioAvatar(sc)`, which follows its frame.
 * Workplace personas come back with no age or presentation, so the demo cast keeps its faces.
 * Athletes and patients get an age and presentation read from their role and voice notes.
 */
export function personaAvatar(persona: PersonaLike & { avatarSeed: string }, setting?: AvatarSetting): AvatarIdentity {
  const patient = /\bpatient\b/i.test(`${persona.role} ${persona.tenure ?? ''}`);
  const resolved = setting ?? settingFromSeed(persona.avatarSeed) ?? (patient ? 'clinical' : 'workplace');
  if (resolved === 'workplace') return { seed: persona.avatarSeed, setting: resolved };
  return {
    seed: persona.avatarSeed,
    age: personaAge(persona),
    setting: resolved,
    presentation: presentationFromText(`${persona.role}. ${persona.tenure ?? ''}. ${persona.voiceNotes ?? ''}`),
  };
}

/** `personaAvatar` for a scenario: its own frame (a coach's athlete) when set, else its setting. */
export function scenarioAvatar(sc: {
  persona: PersonaLike & { avatarSeed: string };
  setting: 'workplace' | 'clinical';
  frame?: 'sports';
}): AvatarIdentity {
  return personaAvatar(sc.persona, sc.frame ?? sc.setting);
}

/**
 * Props for a drill's speaker: `<SpeechCard {...drillSpeakerAvatar(drill)} ... />` (seed/age/setting).
 * The context names the patient's age; a spouse shares it, an adult child speaking for them
 * ("Patient's daughter") or a parent at a pediatric visit is an adult. Workplace drills get
 * no age, so their faces stay exactly as they are today.
 */
export function drillSpeakerAvatar(drill: { id: string; speaker: string; context: string; instruction?: string; setting: AvatarSetting }): AvatarIdentity {
  const seed = `${drill.id}:${drill.speaker}`;
  if (drill.setting !== 'clinical') return { seed, setting: drill.setting };
  const sp = drill.speaker.toLowerCase();
  const relative = /\b(daughter|son|child|grandchild|niece|nephew|parent|mother|father|mom|dad|caregiver)\b/.test(sp);
  const own = /\b(daughter|mother|mom|wife|sister|niece)\b/.test(sp)
    ? 'feminine'
    : /\b(son|father|dad|husband|brother|nephew)\b/.test(sp)
      ? 'masculine'
      : undefined;
  return {
    seed,
    age: relative ? 'adult' : ageFromText(drill.context),
    setting: 'clinical',
    // A relative's pronouns in the context are usually the patient's, so only the speaker word (and the
    // instruction, which talks about whoever is speaking: "what matters to him") counts for them.
    presentation: own ?? presentationFromText(relative ? drill.instruction : `${drill.context} ${drill.instruction ?? ''}`),
  };
}
