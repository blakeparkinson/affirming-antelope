// DRAFT — pending trainer review
// Lessons for the MI for Clinicians pathway. All people and situations are
// fictional. Concepts match the MI for Leaders lessons; examples are clinical.

import type { Lesson } from "./types";

export const CLINICIAN_LESSONS: Lesson[] = [
  // -------------------------------------------------------------------------
  // Unit 1: Foundations
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u1-what-mi-is",
    unitId: "cl-u1-foundations",
    title: "What MI is, and why it works",
    cards: [
      {
        heading: "A conversation about change",
        body: "Motivational Interviewing is a collaborative way of talking with patients about change. It draws out their own reasons instead of handing them yours. It was developed in healthcare and is now used for everything from medications to smoking to sleep.",
      },
      {
        heading: "People argue for what they hear themselves say",
        body: "When you make the case for change, patients tend to make the case against it. When they voice their own reasons, they're more likely to act on them.",
        example: "\"You need to take this every day\" often gets \"I feel fine without it.\" \"What, if anything, worries you about your blood pressure?\" gets a different answer.",
      },
      {
        heading: "The righting reflex",
        body: "Clinicians are trained to fix things. When you see a risk, the urge to correct it is strong, and it comes from caring. In change conversations it often backfires: the patient ends up defending the side you're arguing against.",
      },
      {
        heading: "Why it works",
        body: "MI has been studied in hundreds of trials, for drinking, smoking, medication adherence, diet, and more. The pattern holds: when patients voice their own reasons for change, they're more likely to follow through than when the clinician supplies them.",
      },
      {
        heading: "What it does for you as a clinician",
        body: "MI gives you a way through the conversations that stall: \"I feel fine,\" \"I've tried everything,\" the third visit about the same A1C. Patients feel heard instead of lectured, there's less arguing, and the plan is theirs, so it's more likely to stick. It also takes some weight off you: you don't have to win the argument.",
      },
      {
        heading: "MI isn't a trick",
        body: "MI isn't a technique for getting patients to comply. If you use it to manipulate, people can tell, and it stops working. It's for helping someone find their own reasons, and the decision stays theirs.",
      },
      {
        heading: "Short visits count",
        body: "You don't need an hour. A few minutes of MI in a 15-minute visit can change how the rest of it goes. Short, regular practice builds the habits you'll reach for when the schedule is packed.",
      },
    ],
  },
  {
    id: "lesson-cl-u1-oars",
    unitId: "cl-u3-engaging",
    title: "OARS: four core skills",
    cards: [
      {
        heading: "Open questions",
        body: "Open questions invite a story instead of a yes or no. They usually start with what, how, or tell me.",
        example: "Closed: \"Are you using your inhaler?\" Open: \"How has the inhaler been fitting into your days?\"",
      },
      {
        heading: "Affirmations",
        body: "An affirmation names a real strength, effort, or value you see in the patient. It's specific and about them, not about your approval.",
        example: "\"You came back after a rough first week of rehab. You're sticking with this.\"",
      },
      {
        heading: "Reflections",
        body: "A reflection is a statement, not a question, that says back what you heard. Simple reflections stay close to their words. Complex reflections add meaning or name what's underneath.",
        example: "They say: \"I can't keep track of all these pills.\" Simple: \"It's a lot of pills.\" Complex: \"Keeping up with them feels like a second job.\"",
      },
      {
        heading: "Summaries",
        body: "A summary pulls together several things the patient said, so they can hear their own story. It's useful before you change topics and at the end of a visit.",
        example: "\"So far: the pill made you foggy, you'd like to take fewer of them, and your dad's stroke is on your mind. Did I get that right?\"",
      },
      {
        heading: "Reflect more than you ask",
        body: "A useful habit: aim for about two reflections for every question. Questions gather facts. Reflections show you understood, and in a short visit they often get you to what matters faster than another question would.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 2: The spirit of MI in a 15-minute visit
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u2-spirit",
    unitId: "cl-u2-spirit",
    title: "The spirit behind the skills",
    cards: [
      {
        heading: "Skills without spirit fall flat",
        body: "You can ask open questions and still sound like an intake form. The spirit of MI is the mindset that makes the skills work. The current edition of MI names four parts: partnership, acceptance, compassion, and empowerment.",
      },
      {
        heading: "Partnership",
        body: "You're working with the patient, not on them. You're the expert on the medicine. They're the expert on themselves.",
        example: "\"You know what your week actually looks like. Let's figure out what could fit into it.\"",
      },
      {
        heading: "Acceptance",
        body: "Acceptance means respecting their worth, trying to see things from their side, honoring their right to choose, and noticing their strengths. It doesn't mean you agree with every choice.",
        example: "You can accept that a patient isn't ready to quit smoking and still care a lot about their lungs.",
      },
      {
        heading: "Compassion",
        body: "Compassion means actively working for the patient's wellbeing, with their priorities at the center. It's about them, not about hitting a target or a quality measure.",
      },
      {
        heading: "Empowerment",
        body: "Help patients see and use their own strengths, ideas, and know-how. Assume they already have reasons and some sense of what could work. Earlier editions called this part evocation: drawing out, not putting in.",
        example: "\"What's worked for you before, even for a little while?\"",
      },
      {
        heading: "The choice is theirs",
        body: "Patients decide what goes into their bodies and their lives. Saying so out loud often lowers defensiveness, even when you have a strong recommendation.",
        example: "\"I do recommend it. And it's your decision.\"",
      },
    ],
  },
  {
    id: "lesson-cl-u2-styles",
    unitId: "cl-u2-spirit",
    title: "Guiding, directing, and following",
    cards: [
      {
        heading: "Three ways to help",
        body: "Every clinician moves between three styles. Directing: you tell, they do. Following: you listen and go along. Guiding: you walk alongside, bring your expertise, and help them find their own way. All three have a place.",
      },
      {
        heading: "Directing",
        body: "Directing fits an emergency or a clear clinical instruction. Used for every conversation about behavior change, it tends to get a polite nod and no change.",
        example: "\"Take this twice a day with food.\"",
      },
      {
        heading: "Following",
        body: "Following fits when a patient mostly needs to be heard, like after hard news. Used alone, it can leave the health problem untouched.",
        example: "\"That's a lot to take in.\"",
      },
      {
        heading: "Guiding is the MI style",
        body: "Guiding sits in between. You bring medical knowledge and a direction in mind. They know their own life, values, and reasons. You hold both.",
        example: "Like a good hiking guide: you know the terrain, and they decide where they want to go.",
      },
      {
        heading: "Your role when you wear the MI hat",
        body: "When you put on the MI hat, your job changes. You're not the one who fixes it or convinces them. You're curious, you listen more than you talk, you trust that they have reasons and ideas, and you stay steady when they push back. Your expertise still matters; you offer it with permission instead of leading with it.",
      },
    ],
  },
  {
    id: "lesson-cl-u2-short-visit",
    unitId: "cl-u2-spirit",
    title: "MI in a 15-minute visit",
    cards: [
      {
        heading: "Spirit takes no extra time",
        body: "Partnership and acceptance are about how you talk, not how long. A reflection takes the same ten seconds as a correction.",
      },
      {
        heading: "Start with their agenda",
        body: "Ask what they'd like to get out of the visit in the first minute. It often prevents the \"Oh, one more thing\" at the door.",
        example: "\"What would make today worth the trip for you?\"",
      },
      {
        heading: "One behavior at a time",
        body: "You can't draw out motivation on five fronts at once. Pick one focus together. The rest can go on the list for next time.",
      },
      {
        heading: "Quick moves that work",
        body: "A reflection before advice. Asking permission before information. One ruler question about importance or confidence. A closing summary. Each takes under a minute.",
      },
      {
        heading: "Plant, don't harvest",
        body: "Not every visit ends with a plan. A patient who leaves thinking about their own reasons has made real progress.",
        example: "\"No need to decide anything today. I'd like to hear what you think next time.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 3: Engaging
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u3-engaging",
    unitId: "cl-u3-engaging",
    title: "Engaging: rapport, fast",
    cards: [
      {
        heading: "Trust comes first",
        body: "Engaging is building enough trust and connection that a real conversation can happen. In clinic, it starts the moment you walk into the room.",
      },
      {
        heading: "Lead with curiosity",
        body: "Start by understanding their view before sharing yours. Patients are more open to your concerns once they feel you've heard theirs.",
        example: "\"Before we look at the numbers, how have things been for you since last time?\"",
      },
      {
        heading: "Reflect the feeling under the complaint",
        body: "Complaints often carry a feeling: frustration, worry, feeling brushed off. Reflecting that feeling tells them you're listening for more than the facts.",
        example: "They say: \"I've called three times about this refill.\" You reflect: \"You've done everything you're supposed to, and it still feels like nobody's on your side.\"",
      },
      {
        heading: "Watch for disengagement traps",
        body: "Common traps: rapid-fire closed questions, fixing before understanding, labels like \"noncompliant,\" jumping to your topic, and looking for who's to blame. Each one can make patients go quiet.",
      },
      {
        heading: "The white coat adds weight",
        body: "Many patients expect to be judged before you say a word, especially about weight, drinking, or missed visits. Say what you're there for, and let them have a say in what gets discussed.",
        example: "\"I'm not here to lecture. What's on your mind today?\"",
      },
      {
        heading: "How you'll know it's working",
        body: "Their answers get longer. They bring up things you didn't ask about. They correct your reflections (\"Not exactly, it's more like...\"). These are good signs.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 4: Focusing
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u4-focusing",
    unitId: "cl-u4-focusing",
    title: "Focusing: one visit, many problems",
    cards: [
      {
        heading: "A shared direction",
        body: "Focusing is finding and keeping a direction for the conversation that you both agree on. With several problems and a clock running, it keeps a visit from trying to do everything and doing nothing well.",
      },
      {
        heading: "Three ways a focus shows up",
        body: "Sometimes the focus is clear from the start because they came in about it. Sometimes you choose together from several options. Sometimes you need to explore before a focus emerges.",
      },
      {
        heading: "Agenda mapping",
        body: "Lay out the topics, add your own, and let them choose where to start. It takes about thirty seconds.",
        example: "\"So there's your back, the refills, the snoring, and I'd like to touch on your sugar. Which feels most important today?\"",
      },
      {
        heading: "Ask permission to raise your topic",
        body: "When you have a concern they didn't bring up, asking permission respects their autonomy and makes them more likely to listen.",
        example: "\"Before you go, would it be okay to spend two minutes on smoking?\"",
      },
      {
        heading: "Your agenda counts too",
        body: "Focusing isn't giving up your clinical priorities. A very high blood pressure or a positive screen still needs attention. The skill is raising it in a way that invites partnership and saying why it matters to you.",
      },
      {
        heading: "Park the rest, out loud",
        body: "Naming what you'll come back to keeps their concerns visible and the visit honest.",
        example: "\"Let's put the mole and your sleep at the top of the list for next time.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 5: Evoking change talk
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u5-change-talk",
    unitId: "cl-u5-evoking",
    title: "Evoking: hearing change talk",
    cards: [
      {
        heading: "Evoking draws out their reasons",
        body: "Once you have a focus, evoking helps the patient voice their own motivation for change. The words they use tell you how it's going.",
      },
      {
        heading: "Change talk",
        body: "Change talk is anything the patient says that leans toward change. It's easy to miss because it's often tucked in among reasons not to change.",
        example: "\"I feel fine. But my dad had a stroke at sixty.\"",
      },
      {
        heading: "Desire, ability, reasons, need",
        body: "Early change talk often sounds like wanting (\"I'd like to\"), being able (\"I could\"), reasons (\"It would help me\"), or need (\"I have to\").",
        example: "Desire: \"I'd like to get off some of these pills.\" Ability: \"I quit for six months once.\" Reason: \"I want to keep up with my grandkids.\" Need: \"I've got to do something about my sugar.\"",
      },
      {
        heading: "Commitment, activation, taking steps",
        body: "Later change talk is about doing: \"I will,\" \"I'm ready to,\" or \"I already started.\" This is often a sign they're getting ready to plan.",
        example: "\"I'm going to walk with my sister on Tuesdays.\" \"I already switched the afternoon soda.\"",
      },
      {
        heading: "Sustain talk",
        body: "Sustain talk is the other side: reasons to keep things as they are. It's normal. Most patients feel both ways. Arguing with it usually makes it stronger.",
        example: "\"Everybody on my crew drinks.\"",
      },
      {
        heading: "Respond to change talk",
        body: "When you hear change talk, reflect it, ask for more, or affirm it. Patients tend to say more of what gets attention.",
        example: "They say: \"I don't want to be like my dad.\" You reflect: \"Being there for your kids in a different way really matters to you.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 6: Sustain talk and discord (shorter)
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u6-sustain-discord",
    unitId: "cl-u5-evoking",
    title: "Sustain talk, discord, and the righting reflex",
    cards: [
      {
        heading: "Notice the reflex",
        body: "\"I feel fine\" pulls hard on the urge to correct. A correction invites the patient to argue the other side. Pause and reflect first.",
        example: "\"You feel fine, so it's hard to see what a pill would add.\"",
      },
      {
        heading: "Reflect, don't counter",
        body: "Meet sustain talk with a reflection. A double-sided reflection that ends on their change talk keeps both sides in view.",
        example: "\"Cooking differently feels impossible on your budget, and you want to be around for your grandson.\"",
      },
      {
        heading: "Discord is about the relationship",
        body: "Sustain talk is about the change. Discord is tension between the two of you: \"You people just push pills.\" Reflect it, apologize when it fits, and shift the focus back to them. Don't defend yourself or the clinic.",
        example: "\"I'm sorry about the wait. You gave up a lot to be here today.\"",
      },
      {
        heading: "Emphasize their choice",
        body: "Saying plainly that the decision is theirs often softens pushback more than any argument could.",
        example: "\"It's your call. I'm here either way.\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 7: Giving information (shorter)
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u6-eliciting",
    unitId: "cl-u6-sustain-discord",
    title: "Eliciting change talk",
    cards: [
      {
        heading: "Don't wait for it, invite it",
        body: "Last week you learned to hear change talk and respond to it. This week you draw it out on purpose, with questions whose honest answer is a reason to change.",
      },
      {
        heading: "Evocative questions",
        body: "Ask about desire, ability, reasons, and need directly.",
        example: "\"What would be better for you if you cut back?\" \"If you decided to, how might you start?\" \"What worries you about your sugars?\"",
      },
      {
        heading: "Importance and confidence rulers",
        body: "Ask \"On a scale of 0 to 10, how important is this to you?\" Then ask why they're not lower: \"Why a 4 and not a 1?\" Their answer is change talk. Asking \"Why only a 4?\" gets the opposite. Confidence works the same way: \"What would help move it from a 6 to a 7?\"",
      },
      {
        heading: "Look back, look forward",
        body: "Ask about a time before the problem, or a future where things have changed.",
        example: "\"What were things like before the smoking picked up?\" \"If you were feeling better a year from now, what would be different?\"",
      },
      {
        heading: "Ask for more",
        body: "Once change talk shows up, keep it going: ask for an example, affirm it, reflect it, or summarize it.",
        example: "\"You said you want to keep up with your grandson. Tell me more about that.\"",
      },
    ],
  },
  {
    id: "lesson-cl-u8-together",
    unitId: "cl-u8-planning",
    title: "Putting the four processes together",
    cards: [
      {
        heading: "Not a straight line",
        body: "Engaging, focusing, evoking, and planning build on each other, but real visits loop back. If planning stalls, check whether engagement or focus has slipped.",
      },
      {
        heading: "Use everything",
        body: "In a full visit you'll engage, find a focus, evoke, and plan, often in fifteen minutes. Use the full role-plays this week to practice moving between them.",
      },
    ],
  },
  {
    id: "lesson-cl-u7-giving-information",
    unitId: "cl-u7-informing",
    title: "Giving information: Elicit-Provide-Elicit",
    cards: [
      {
        heading: "Ask permission first",
        body: "Unless they asked, check before sharing. It turns a lecture into an offer, and patients listen better to offers.",
        example: "\"Would it be okay if I shared what we know about statins and muscle aches?\"",
      },
      {
        heading: "Elicit-Provide-Elicit",
        body: "Elicit what they already know or want to know. Provide a small, clear piece of information, without telling them what it has to mean for them. Elicit their reaction. You may also hear it called ask, offer, ask.",
        example: "\"What have you heard about the shingles vaccine?\" ... \"Many people feel achy or tired for a day or two afterward.\" ... \"What do you make of that?\"",
      },
      {
        heading: "Offer a menu",
        body: "Talking about what other people do (\"Some people try...\") lets patients take what fits. Several options beat a single prescription.",
      },
      {
        heading: "Your recommendation still matters",
        body: "When a patient asks what you'd recommend, tell them clearly. Then hand the decision back.",
        example: "\"My recommendation is to get your blood pressure treated again. You'd know best what you can stick with. What do you think?\"",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Unit 8: Planning and integration (shorter)
  // -------------------------------------------------------------------------
  {
    id: "lesson-cl-u8-planning",
    unitId: "cl-u7-informing",
    title: "Planning when they're ready",
    cards: [
      {
        heading: "Listen for readiness",
        body: "More change talk, less sustain talk, questions about how, and imagining life after the change are signs a patient may be ready to plan. Planning too early can undo good work.",
        example: "\"If I tried the patch, would I put it on in the morning or at night?\"",
      },
      {
        heading: "Their plan, in their words",
        body: "Ask a key question (\"So what do you think you'll do?\"), then help them make it specific: what, when, and what might get in the way. Keep their wording.",
      },
      {
        heading: "Close with a summary",
        body: "End with a short summary of what they said and decided, and leave the door open.",
        example: "\"So you'll walk with your sister on Tuesdays and Saturdays. Let's see how it goes, and we can change the plan if it isn't working.\"",
      },
    ],
  },
];
