// DRAFT — pending trainer review
// All people, workplaces, and situations are fictional.

import type { Lesson } from "./types";
import { CLINICIAN_LESSONS } from "./lessons-clinicians";

export { CLINICIAN_LESSONS };

export const LESSONS: Lesson[] = [
  // -------------------------------------------------------------------------
  // Unit 1: Foundations
  // -------------------------------------------------------------------------
  {
    id: "lesson-u01-what-mi-is",
    unitId: "u01-foundations",
    title: "What MI is, and why it works",
    cards: [
      {
        heading: "A conversation about change",
        body: "Motivational Interviewing is a way of talking with someone about change that draws out their own reasons, rather than handing them yours. It was developed in healthcare, and it works in leadership too.",
      },
      {
        heading: "People argue for what they hear themselves say",
        body: "When you make the case for change, the other person tends to make the case against it. When they make the case themselves, they're more likely to act on it.",
        example: "\"You need to get these reports in on time\" often gets \"I would if the data were ready.\" \"What would getting them in on time do for you?\" gets a different answer.",
      },
      {
        heading: "The righting reflex",
        body: "Most leaders feel a strong pull to fix, correct, or advise. It comes from caring. In change conversations it usually backfires, because it puts them on the other side of the argument.",
      },
      {
        heading: "Why it works",
        body: "MI has been studied in hundreds of trials across healthcare, and the pattern holds: when people voice their own reasons for change, they're more likely to follow through than when someone else supplies the reasons.",
      },
      {
        heading: "What it does for you as a leader",
        body: "MI gives you a way into the conversations you'd rather avoid: performance, burnout, change, motivation. People feel heard instead of managed, they get less defensive, and the plan that comes out is theirs, so it's more likely to stick.",
        example: "Instead of repeating the same expectation every month, you help them find their own reason to meet it.",
      },
      {
        heading: "MI isn't a trick",
        body: "MI isn't a way to get people to do what you want. If you're using it to manipulate, people can tell, and it stops working. It's for helping someone find their own reasons.",
      },
      {
        heading: "Practice is the point",
        body: "MI is simple to describe and hard to do under pressure. Short, regular practice builds the habits you'll reach for in real conversations.",
      },
    ],
  },
  {
    id: "lesson-u01-oars",
    unitId: "u03-engaging",
    title: "OARS: four core skills",
    cards: [
      {
        heading: "Open questions",
        body: "Open questions invite a story instead of a yes or no. They usually start with what, how, or tell me.",
        example: "Closed: \"Is the new schedule working?\" Open: \"How's the new schedule been for you?\"",
      },
      {
        heading: "Affirmations",
        body: "An affirmation names a real strength, effort, or value you see in the person. It's specific and about them, not about your approval.",
        example: "\"You stayed late to make sure the handoff was clean. You really look out for your team.\"",
      },
      {
        heading: "Reflections",
        body: "A reflection is a statement, not a question, that says back what you heard. Simple reflections stay close to their words. Complex reflections add meaning or name what's underneath.",
        example: "They say: \"I'm buried in tickets.\" Simple: \"You're buried.\" Complex: \"You're carrying more than one person can keep up with.\"",
      },
      {
        heading: "Summaries",
        body: "A summary pulls together several things they've said, so they can hear their own story. It's a good way to check understanding or move the conversation forward.",
      },
      {
        heading: "Reflect more than you ask",
        body: "A useful habit: aim for about two reflections for every question. Questions gather facts. Reflections show you understood, and they often get you more than another question would.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 2: Guiding, directing, following, and your role
  // -------------------------------------------------------------------------
  {
    id: "lesson-u02-styles",
    unitId: "u02-spirit",
    title: "Guiding, directing, and following",
    cards: [
      {
        heading: "Three ways to help",
        body: "Every leader moves between three styles. Directing: you tell, they do. Following: you listen and go along. Guiding: you walk alongside, bring what you know, and help them find their own way. All three have a place.",
      },
      {
        heading: "Directing",
        body: "Directing fits when there's one right answer or real urgency: a safety rule, a hard deadline. Used for every conversation about change, it tends to get compliance at best and pushback at worst.",
        example: "\"The full wipe-down is required between every patient.\"",
      },
      {
        heading: "Following",
        body: "Following fits when someone mostly needs to be heard. Used alone, it can leave a problem untouched and the person without help.",
        example: "\"That sounds like a really hard week.\"",
      },
      {
        heading: "Guiding is the MI style",
        body: "Guiding sits in between. You have expertise and a direction in mind. They know their own work, life, and reasons. You hold both.",
        example: "Like a good hiking guide: you know the terrain, and they decide where they want to go.",
      },
      {
        heading: "Your role when you wear the MI hat",
        body: "When you put on the MI hat, your job changes. You're not the fixer or the judge. You're curious, you listen more than you talk, you trust that they have reasons and ideas, and you stay steady when they push back. You still hold expectations; you just stop carrying the whole argument.",
      },
      {
        heading: "Notice which hat you're wearing",
        body: "Before a hard conversation, ask yourself: do I need to direct here, or guide? If it's about change, start by guiding. You can still direct on what's non-negotiable.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 2: Spirit of MI
  // -------------------------------------------------------------------------
  {
    id: "lesson-u02-spirit",
    unitId: "u02-spirit",
    title: "The spirit behind the skills",
    cards: [
      {
        heading: "Skills without spirit fall flat",
        body: "You can ask open questions and still come across as interrogating. The spirit of MI is the mindset that makes the skills work. It has four parts: partnership, acceptance, compassion, and evocation.",
      },
      {
        heading: "Partnership",
        body: "You're working with them, not on them. You have expertise and a role to play. They're the expert on their own work, life, and motivations.",
        example: "\"You know this workflow better than anyone. I'd like to figure this out with you.\"",
      },
      {
        heading: "Acceptance",
        body: "Acceptance means respecting their worth, trying to see things from their side, honoring their right to choose, and noticing their strengths. It doesn't mean you approve of everything they do.",
        example: "You can accept that someone is frustrated with a policy and still expect them to follow it.",
      },
      {
        heading: "Compassion",
        body: "Keep their wellbeing in view. As a leader you have goals for the team, and you also care what happens to this person.",
      },
      {
        heading: "Evocation",
        body: "Assume they already have reasons and ideas for change. Your job is to draw those out, not to install new ones.",
        example: "\"What would you like to be different about how month-end goes?\"",
      },
      {
        heading: "Autonomy is real, even at work",
        body: "Some expectations aren't up for debate. People still choose how they respond. Saying that out loud often lowers defensiveness.",
        example: "\"The deadline is firm. How you get there is your call.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 3: Engaging
  // -------------------------------------------------------------------------
  {
    id: "lesson-u03-engaging",
    unitId: "u03-engaging",
    title: "Engaging: building the working relationship",
    cards: [
      {
        heading: "Trust comes first",
        body: "Engaging is the process of building enough trust and connection that a real conversation can happen. Without it, everything else stalls.",
      },
      {
        heading: "Lead with curiosity",
        body: "Start by understanding their view before sharing yours. People are more open to your agenda once they feel you've heard theirs.",
        example: "\"Before we get into anything, how have things been going for you lately?\"",
      },
      {
        heading: "Reflect the feeling under the complaint",
        body: "Complaints often carry a feeling: frustration, worry, feeling unseen. Reflecting that feeling tells them you're listening for more than the facts.",
        example: "They say: \"I've submitted nine tickets.\" You reflect: \"You've been doing what you were asked, and it feels like no one's listening.\"",
      },
      {
        heading: "Watch for disengagement traps",
        body: "Common traps: asking question after question, jumping to fixes, labeling the problem, or rushing to your topic. Each one can make people go quiet.",
      },
      {
        heading: "Your role adds weight",
        body: "As their manager, a request to talk can feel like a warning. Be honest about why you're meeting, and say so early if it isn't disciplinary.",
        example: "\"This isn't about a mistake. I've noticed you seem quieter, and I wanted to check in.\"",
      },
      {
        heading: "How you'll know it's working",
        body: "Their answers get longer. They bring up things you didn't ask about. The pace slows down. These are signs they're engaging with you.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 4: Focusing
  // -------------------------------------------------------------------------
  {
    id: "lesson-u04-focusing",
    unitId: "u04-focusing",
    title: "Focusing: agreeing on what this is about",
    cards: [
      {
        heading: "A shared direction",
        body: "Focusing is finding and keeping a clear direction for the conversation, one you both agree on. Without it, conversations wander or turn into a lecture.",
      },
      {
        heading: "Three ways a focus shows up",
        body: "Sometimes the focus is clear from the start. Sometimes you need to choose from several options. Sometimes you need to explore before a focus emerges.",
      },
      {
        heading: "Ask permission to raise your topic",
        body: "When you have something to discuss, asking permission respects their autonomy and makes them more likely to listen.",
        example: "\"Would it be okay if we spent a few minutes on the chart notes?\"",
      },
      {
        heading: "Agenda mapping",
        body: "When there's a lot going on, lay the options out and let them choose where to start. You can add your own topic to the list.",
        example: "\"So there's staffing, the new metrics, the team conflict, and your reviews. Where would you like to start?\"",
      },
      {
        heading: "Ask, offer, ask",
        body: "When you need to share information, first ask what they know, then offer what's useful, then ask what they make of it. It keeps information from turning into a lecture.",
        example: "\"What have you heard about the new float policy?\" ... \"Here's how it works.\" ... \"How does that fit with what you expected?\"",
      },
      {
        heading: "Your agenda counts too",
        body: "Focusing isn't giving up your topic. As a leader, some things need to be discussed. The skill is raising them in a way that invites partnership.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 5: Evoking I
  // -------------------------------------------------------------------------
  {
    id: "lesson-u05-change-talk",
    unitId: "u05-evoking-1",
    title: "Hearing change talk",
    cards: [
      {
        heading: "Evoking draws out their reasons",
        body: "Once you have a focus, evoking is about helping them voice their own motivation for change. The words they use tell you how it's going.",
      },
      {
        heading: "Change talk",
        body: "Change talk is anything they say that leans toward change. It's easy to miss because it's often mixed in with reasons not to change.",
        example: "\"I don't love being the bottleneck.\"",
      },
      {
        heading: "Desire, ability, reasons, need",
        body: "Early change talk often sounds like wanting (\"I'd like to\"), being able (\"I could\"), reasons (\"It would help the team\"), or need (\"I have to\").",
        example: "Desire: \"I want to get back to where I was.\" Ability: \"I could block time on Fridays.\"",
      },
      {
        heading: "Commitment, activation, taking steps",
        body: "Later change talk is about doing: \"I will,\" \"I'm ready to,\" or \"I already started.\" This is often a sign they're getting ready to plan.",
        example: "\"I'm going to talk to finance about the template this week.\"",
      },
      {
        heading: "Sustain talk",
        body: "Sustain talk is the other side: reasons to keep things as they are. It's normal. Most people feel both ways. Arguing with it usually makes it stronger.",
        example: "\"Nobody reads those reports until the 10th anyway.\"",
      },
      {
        heading: "Reflect the change talk",
        body: "When you hear change talk, reflect it, ask for more, or affirm it. People tend to say more of what gets attention.",
        example: "They say: \"I don't want to be that guy.\" You reflect: \"Being someone the team can count on matters to you.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Units 6-12: stubs (to be expanded)
  // -------------------------------------------------------------------------
  {
    id: "lesson-u06-sustain-talk",
    unitId: "u05-evoking-1",
    title: "Responding to sustain talk",
    cards: [
      {
        heading: "Don't argue the other side",
        body: "When you hear sustain talk, reflect it instead of countering it. A double-sided reflection that ends on their change talk keeps both sides in view.",
        example: "\"It doesn't feel like a big deal to you, and you also get why I'm raising it.\"",
      },
      {
        heading: "Emphasize their choice",
        body: "Saying plainly that the decision is theirs often softens resistance more than any argument could.",
      },
    ],
  },
  {
    id: "lesson-u06-eliciting",
    unitId: "u06-evoking-2",
    title: "Eliciting change talk",
    cards: [
      {
        heading: "Don't wait for it, invite it",
        body: "Last week you learned to hear change talk and respond to it. This week you draw it out on purpose, with questions whose honest answer is a reason to change.",
      },
      {
        heading: "Evocative questions",
        body: "Ask about desire, ability, reasons, and need directly.",
        example: "\"What would be better if this changed?\" \"If you decided to, how might you do it?\" \"What worries you about how things are now?\"",
      },
      {
        heading: "Importance and confidence rulers",
        body: "Ask, \"On a scale of 0 to 10, how important is this to you?\" Then ask why they're not lower: \"Why a 5 and not a 2?\" Their answer is change talk. \"Why only a 5?\" gets the opposite. Confidence works the same way: \"What would it take to move from a 4 to a 5?\"",
      },
      {
        heading: "Look back, look forward",
        body: "Ask about a time things were better, or a future where they've changed.",
        example: "\"What was month-end like when it was going well?\" \"If this were working a year from now, what would be different?\"",
      },
      {
        heading: "Explore the extremes",
        body: "Ask about the worst that could happen if nothing changes, or the best that could happen if it does.",
        example: "\"What's the best thing that could come of sorting this out?\"",
      },
      {
        heading: "When you hear it, ask for more",
        body: "Once change talk shows up, keep it going: ask for an example, affirm it, reflect it, or summarize it. People tend to say more of what gets attention.",
        example: "\"You said you miss being the one people count on. Tell me more about that.\"",
      },
    ],
  },
  {
    id: "lesson-u07-planning",
    unitId: "u07-planning",
    title: "Planning when they're ready",
    cards: [
      {
        heading: "Listen for readiness",
        body: "More change talk, less sustain talk, questions about next steps, and talk of trying things are signs they may be ready to plan. Planning too early can undo good work.",
        example: "\"So what would I even do first?\"",
      },
    ],
  },
  {
    id: "lesson-u08-integration",
    unitId: "u08-integration",
    title: "Putting the four processes together",
    cards: [
      {
        heading: "Not a straight line",
        body: "Engaging, focusing, evoking, and planning build on each other, but real conversations loop back. If the conversation stalls, check whether engagement or focus has slipped.",
      },
    ],
  },
  {
    id: "lesson-u09-self-coding",
    unitId: "u09-self-coding",
    title: "Coding your own conversations",
    cards: [
      {
        heading: "Notice your own habits",
        body: "Listening back to your own conversation and naming each move (question, reflection, affirmation, advice) is one of the fastest ways to grow. Look for patterns, not perfection.",
      },
    ],
  },
  {
    id: "lesson-u10-leadership",
    unitId: "u10-leadership",
    title: "MI when you're the boss",
    cards: [
      {
        heading: "Expectations and autonomy can coexist",
        body: "You can be clear about what's required and still invite their ideas on how. Name the non-negotiables plainly, then hand the how back to them.",
        example: "\"The third business day is firm. How you get there is up to you.\"",
      },
      {
        heading: "When the stakes are yours too",
        body: "When the outcome matters to you, the righting reflex gets louder. Notice it, take a breath, and reflect before you advise.",
      },
    ],
  },
  {
    id: "lesson-u11-discord",
    unitId: "u11-advanced-1",
    title: "Working with discord",
    cards: [
      {
        heading: "Discord is about the relationship",
        body: "Sustain talk is about the change. Discord is tension between the two of you: defending, interrupting, or pushing back on you. Respond by reflecting, apologizing when it fits, or shifting focus.",
      },
    ],
  },
  {
    id: "lesson-u12-staying-steady",
    unitId: "u12-advanced-2",
    title: "Staying steady in hard conversations",
    cards: [
      {
        heading: "Slow down when it heats up",
        body: "In the hardest moments, the simplest skills matter most. A short, accurate reflection does more than a clever reframe.",
      },
    ],
  },

  // MI for Clinicians lessons live in lessons-clinicians.ts.
  ...CLINICIAN_LESSONS,
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
