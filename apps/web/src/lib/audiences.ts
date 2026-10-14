import {
  DRILLS,
  MI_FOR_CLINICIANS,
  MI_FOR_LEADERS,
  SCENARIOS,
  type Pathway,
  type Setting,
} from "@antelope/core";
import { PRICING_LINE, type Audience } from "@/lib/site";

/**
 * Shared copy for the three audience pages. Each page's middle sections (the scene, the
 * product shot, the role-plays) live in `src/components/audience/*`, so no two pages
 * share a skeleton.
 */
export type AudiencePage = {
  slug: Audience;
  /** Short name for nav, breadcrumbs, and the OG image. */
  name: string;
  /** Link text from the other audience pages. */
  linkLabel: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  /** The one orientation label on the page, above the h1. */
  eyebrow: string;
  h1: string;
  lede: string;
  /** Hero showcase card. */
  showcase: "drill" | "pathway" | "cohort";
  /** Which role-plays to list; omitted shows every setting. */
  setting?: Setting;
  faqHeading: string;
  faq: { q: string; a: string }[];
  guidesHeading: string;
  /** Guide slugs for the aside, in order. */
  guides: string[];
  closingHeading: string;
  closingBody: string;
  /** schema.org audienceType for SoftwareApplication. */
  audienceType: string;
};

export const drillCount = DRILLS.length;
export const scenarioCount = SCENARIOS.length;

/** Weeks, the shortest and longest week, and the range for each kind of activity, in minutes. */
export function pathwayStats(pathway: Pathway) {
  const weekMinutes = pathway.units.map((u) => u.activities.reduce((sum, a) => sum + a.minutes, 0));
  const all = pathway.units.flatMap((u) => u.activities);
  const range = (kind: string) => {
    const m = all.filter((a) => a.kind === kind).map((a) => a.minutes);
    return { min: Math.min(...m), max: Math.max(...m) };
  };
  const firstRoleplayWeek = pathway.units.find((u) => u.activities.some((a) => a.kind === "roleplay"))?.week ?? 1;
  return {
    weeks: pathway.units.length,
    min: Math.min(...weekMinutes),
    max: Math.max(...weekMinutes),
    drill: range("drill"),
    roleplay: range("roleplay"),
    firstRoleplayWeek,
  };
}
export const leaders = pathwayStats(MI_FOR_LEADERS);
export const clinicians = pathwayStats(MI_FOR_CLINICIANS);

// Leaders first: the order here is the order of every list of pathways on the site.
export const AUDIENCES: Record<Audience, AudiencePage> = {
  leaders: {
    slug: "leaders",
    name: "Healthcare leaders",
    linkLabel: "MI for healthcare leaders",
    metaTitle: "Motivational interviewing training for healthcare leaders",
    metaDescription: `Practice motivational interviewing for performance conversations with simulated employees. A free ${leaders.weeks}-week pathway for healthcare managers and supervisors.`,
    keywords: [
      "motivational interviewing for leaders",
      "motivational interviewing for managers",
      "motivational interviewing performance management",
      "difficult conversations practice healthcare",
    ],
    eyebrow: "Motivational interviewing practice for leaders",
    h1: "Practice the one-on-one you've been putting off",
    lede: "Josh's reports are late again, and Lucia has stopped speaking up in huddles. Talk it through with them here first. Each simulated employee has reasons you'll have to draw out.",
    showcase: "pathway",
    setting: "workplace",
    faqHeading: "Questions from managers",
    faq: [
      {
        q: "Isn't motivational interviewing for patients?",
        a: "It started in addiction treatment and spread through healthcare from there. The same skills help when you need someone to change and can't make them: you reflect what you hear and draw out their own reasons. If you want to practice patient visits, MI for Clinicians has its own drills and role-plays.",
      },
      {
        q: "How much time does it take?",
        a: `A drill takes ${leaders.drill.min} to ${leaders.drill.max} minutes and a role-play ${leaders.roleplay.min} to ${leaders.roleplay.max}. You can do a drill before a shift and save the role-play for a quieter half hour.`,
      },
      {
        q: "Will my boss or my team see my practice?",
        a: "Your role-plays stay in your account. If you join a trainer's cohort, the trainer sees what you've completed and reads only the role-plays you send.",
      },
      {
        q: "Can my managers practice together?",
        a: "Yes. A trainer or team lead sets up a cohort, assigns practice with due dates, and reviews the role-plays people send. Book a 30-minute call to set up a pilot.",
      },
      {
        q: "What does it cost?",
        a: PRICING_LINE,
      },
    ],
    guidesHeading: "Guides for managers",
    guides: ["motivational-interviewing-for-managers", "what-is-motivational-interviewing", "responding-to-sustain-talk"],
    closingHeading: "Practice the next one-on-one first",
    closingBody: "Start with week one, or open Josh's role-play and see how far you get.",
    audienceType: "Healthcare managers, supervisors, and team leads",
  },

  trainers: {
    slug: "trainers",
    name: "MI trainers",
    linkLabel: "For MI trainers and team leads",
    metaTitle: "Motivational interviewing training tools for trainers",
    metaDescription:
      "Give your motivational interviewing cohort practice between sessions. Assign drills and role-plays, see who's practicing, and review what learners send.",
    keywords: [
      "motivational interviewing training tools",
      "MI trainer practice platform",
      "motivational interviewing coaching feedback",
      "motivational interviewing cohort",
    ],
    eyebrow: "For MI trainers and team leads",
    h1: "Give your cohort practice between sessions",
    lede: "Assign role-plays after each session. When a learner sends one back, you coach it with the transcript and their note in front of you.",
    showcase: "cohort",
    faqHeading: "Before you book a call",
    faq: [
      {
        q: "How do I get trainer access?",
        a: "Trainer accounts are in early access, so you need a trainer code. Codes come from your program lead or from us. Book a 30-minute call if you don't have one, then sign in to the dashboard with your email and enter it.",
      },
      {
        q: "What do learners need?",
        a: "A browser. They sign in to the app and enter your cohort's join code. Your assignments and feedback show up there.",
      },
      {
        q: "Can I see every conversation my learners have?",
        a: "No. You see assigned and completed work for everyone. A transcript reaches you only when a learner sends a role-play for review, and they can withdraw it.",
      },
      {
        q: "Can I write my own scenarios?",
        a: "Not yet. Assignments come from the built-in library, filtered to your cohort's pathway. Every scenario is fictional.",
      },
      {
        q: "What does it cost?",
        a: PRICING_LINE,
      },
    ],
    guidesHeading: "Guides to share with a cohort",
    guides: ["how-to-practice-motivational-interviewing", "oars-motivational-interviewing", "change-talk-vs-sustain-talk"],
    closingHeading: "Plan your next cohort's practice",
    closingBody:
      "Talk it through with Blake in a 30-minute call. If you already have a trainer code, open the dashboard and create the cohort yourself.",
    audienceType: "Motivational Interviewing trainers and training programs",
  },

  clinicians: {
    slug: "clinicians",
    name: "Clinicians",
    linkLabel: "MI for clinicians",
    metaTitle: "Motivational interviewing practice for clinicians",
    metaDescription: `Free motivational interviewing practice for physicians, nurses, therapists, and health coaches. Five-minute drills and role-plays with realistic simulated patients.`,
    keywords: [
      "motivational interviewing practice for clinicians",
      "motivational interviewing for nurses",
      "motivational interviewing for physicians",
      "motivational interviewing patient role play",
      "OARS practice",
      "reflective listening practice",
    ],
    eyebrow: "For clinicians and health coaches",
    h1: "Keep your MI sharp between trainings",
    lede: "You learned OARS in a workshop. A few busy clinic weeks later, you're asking three closed questions in a row again. Practice with fictional patients, five minutes at a time.",
    showcase: "drill",
    setting: "clinical",
    faqHeading: "Clinical questions",
    faq: [
      {
        q: "Does it give medical advice?",
        a: "No. It coaches the conversation. Feedback covers how you asked, reflected, and shared information, and leaves doses and guidelines to you.",
      },
      {
        q: "Has the clinical content been reviewed?",
        a: "Not yet. The patient drills and role-plays are drafts waiting on review by an MI trainer. Use them as practice material, and keep using your own clinical guidance.",
      },
      {
        q: "Does it count toward CE or CME credit?",
        a: "No. Affirming Antelope isn't an accredited course. Use it to keep practicing between the trainings that award credit.",
      },
      {
        q: "Should I type in real patient details?",
        a: "No. Every scenario is fictional, and an AI model reads your replies to play the patient and write feedback. Keep real patient and colleague information out of it.",
      },
      {
        q: "What does it cost?",
        a: `${PRICING_LINE} You can start as a guest, with no card.`,
      },
    ],
    guidesHeading: "Guides for clinic visits",
    guides: ["reflective-listening-examples", "open-ended-questions-examples", "change-talk-vs-sustain-talk"],
    closingHeading: "One drill before clinic",
    closingBody: "Open it in your browser and do one drill. If it helps, do another tomorrow.",
    audienceType: "Clinicians, nurses, therapists, and health coaches",
  },
};

export const AUDIENCE_SLUGS = Object.keys(AUDIENCES) as Audience[];

export function getAudience(slug: string): AudiencePage | undefined {
  return (AUDIENCES as Record<string, AudiencePage>)[slug];
}
