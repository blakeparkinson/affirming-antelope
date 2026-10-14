// DRAFT — pending trainer review
// All people, workplaces, and situations are fictional.

import type { Drill, PathwayId, Setting } from "./types";
import { CLINICIAN_DAILY_DRILL_ORDER, CLINICIAN_DRILLS } from "./drills-clinicians";

export { CLINICIAN_DAILY_DRILL_ORDER, CLINICIAN_DRILLS };

export const DRILLS: Drill[] = [
  // -------------------------------------------------------------------------
  // OARS
  // -------------------------------------------------------------------------
  {
    id: "drill-oars-01",
    setting: "workplace",
    skill: "oars",
    level: 1,
    context: "A clinic supervisor, checking in with a medical assistant after a busy week",
    speaker: "Medical assistant",
    prompt: "It's been a lot. Mondays are always rough, but this week every day felt like a Monday.",
    instruction: "Which response is an open question?",
    choices: [
      {
        text: "Was it the staffing gaps again?",
        isTarget: false,
        explanation: "This can be answered with yes or no, so it's a closed question. It also guesses at the cause for them.",
      },
      {
        text: "What made this week feel so heavy?",
        isTarget: true,
        explanation: "This invites them to describe the week in their own words. They decide what matters.",
      },
      {
        text: "Do you want to take a long weekend?",
        isTarget: false,
        explanation: "A yes-or-no question that jumps to a solution before you understand the problem.",
      },
      {
        text: "Sounds like the whole week wore you down.",
        isTarget: false,
        explanation: "This is a reflection, not a question. It's a good move, just not the one asked for here.",
      },
    ],
    exampleResponses: ["What made this week feel so heavy?"],
  },
  {
    id: "drill-oars-02",
    setting: "workplace",
    skill: "oars",
    level: 1,
    context: "A nurse manager, one-on-one with a charge nurse",
    speaker: "Charge nurse",
    prompt: "I keep picking up extra shifts because nobody else will. I don't mind, really. It's just that my kids are starting to notice.",
    instruction: "Which response is a complex reflection?",
    choices: [
      {
        text: "You keep picking up extra shifts.",
        isTarget: false,
        explanation: "This repeats what they said. It's a simple reflection: accurate, but it doesn't add meaning.",
      },
      {
        text: "You care about the unit, and you're starting to feel what it's costing your family.",
        isTarget: true,
        explanation: "This goes past the words to the tension underneath: loyalty to the team and the pull of home.",
      },
      {
        text: "Have you thought about saying no?",
        isTarget: false,
        explanation: "A closed question that slides toward advice. It skips over what they just shared.",
      },
    ],
    exampleResponses: ["You care about the unit, and you're starting to feel what it's costing your family."],
  },
  {
    id: "drill-oars-03",
    setting: "workplace",
    skill: "oars",
    level: 1,
    context: "A practice manager, after a front desk lead handled an upset patient",
    speaker: "Front desk lead",
    prompt: "I almost lost it with that guy. I just kept telling myself he was scared, not mad at me.",
    instruction: "Which response is an affirmation rather than praise?",
    choices: [
      {
        text: "Great job!",
        isTarget: false,
        explanation: "That's praise. It's kind, but it's about your judgment and doesn't name anything specific about them.",
      },
      {
        text: "You stayed patient by looking for what he was going through. That takes real steadiness.",
        isTarget: true,
        explanation: "An affirmation names a specific strength or effort of theirs. This one points to how they chose to see him.",
      },
      {
        text: "I'm proud of you.",
        isTarget: false,
        explanation: "This centers your feelings, so it's closer to praise. Affirmations keep the spotlight on them.",
      },
      {
        text: "Next time, just call security sooner.",
        isTarget: false,
        explanation: "Advice nobody asked for. It also misses the skill they just showed.",
      },
    ],
    exampleResponses: ["You stayed patient by looking for what he was going through. That takes real steadiness."],
  },
  {
    id: "drill-oars-04",
    setting: "workplace",
    skill: "oars",
    level: 2,
    context: "A lab supervisor, after a tech has been arriving late",
    speaker: "Lab tech",
    prompt: "Traffic on the bridge has been terrible since the construction started. I leave earlier, and it still doesn't matter.",
    instruction: "Respond with an open question that helps you understand their situation.",
    exampleResponses: [
      "What have mornings been like since the construction started?",
      "What have you tried so far, and how has it gone?",
    ],
  },
  {
    id: "drill-oars-05",
    setting: "workplace",
    skill: "oars",
    level: 2,
    context: "A clinic director, talking with a provider about patient complaints",
    speaker: "Physician assistant",
    prompt: "I'm running forty minutes behind by noon most days. Of course people are complaining. I would too.",
    instruction: "Respond with a simple reflection. Stay close to their words.",
    exampleResponses: [
      "You're running way behind by midday, and you get why patients are frustrated.",
      "You'd complain too in their shoes.",
    ],
  },
  {
    id: "drill-oars-06",
    setting: "workplace",
    skill: "oars",
    level: 2,
    context: "A nurse manager, with a new graduate nurse after a hard shift",
    speaker: "New graduate nurse",
    prompt: "I double-checked everything and I still almost missed that med interaction. Pharmacy caught it. I feel like I'm not cut out for this.",
    instruction: "Offer a genuine affirmation. Name something specific about them, not your opinion of them.",
    exampleResponses: [
      "You double-checked everything, and you're taking this seriously because patient safety matters to you.",
      "You're holding yourself to a high standard, even on a hard day.",
    ],
  },
  {
    id: "drill-oars-07",
    setting: "workplace",
    skill: "oars",
    level: 3,
    context: "A department lead, end of a one-on-one with a billing specialist",
    speaker: "Billing specialist",
    prompt:
      "So yeah, the new coding rules are confusing, I'm behind on denials, and I haven't asked for help because everyone's slammed. But I also know if I don't catch up, it lands on Maria when I'm out next month.",
    instruction: "Offer a short summary that pulls together what you've heard, including what matters to them.",
    exampleResponses: [
      "Let me see if I've got it. The coding changes are confusing, the denials are piling up, and you haven't wanted to add to anyone's load. At the same time, you don't want Maria stuck with this while you're out. Did I miss anything?",
    ],
  },

  // -------------------------------------------------------------------------
  // Engaging
  // -------------------------------------------------------------------------
  {
    id: "drill-engaging-01",
    setting: "workplace",
    skill: "engaging",
    level: 1,
    context: "A clinic supervisor, first check-in with a medical assistant who seems withdrawn",
    speaker: "Medical assistant",
    prompt: "I'm fine. Just tired. Is this about the room turnover times?",
    instruction: "Which response is most likely to build engagement?",
    choices: [
      {
        text: "Yes, turnover has been slow. Let's talk about how to fix it.",
        isTarget: false,
        explanation: "Jumping straight to your agenda confirms their worry and can shut the conversation down.",
      },
      {
        text: "No, not at all. I just want to make sure you're okay. Are you okay?",
        isTarget: false,
        explanation: "Warm, but the closed question makes 'I'm fine' the easy answer.",
      },
      {
        text: "Sounds like you were bracing for bad news. I mostly wanted to hear how things are going for you lately.",
        isTarget: true,
        explanation: "A reflection of their worry plus an honest statement of purpose. It lowers the stakes without pretending.",
      },
    ],
    exampleResponses: ["Sounds like you were bracing for bad news. I mostly wanted to hear how things are going for you lately."],
  },
  {
    id: "drill-engaging-02",
    setting: "workplace",
    skill: "engaging",
    level: 2,
    context: "A pharmacy manager, after a tech vents in a one-on-one",
    speaker: "Pharmacy tech",
    prompt: "Every time I flag a problem with the new system, I get told to submit a ticket. I've submitted nine tickets. Nine.",
    instruction: "Reflect the feeling under the complaint before you do anything else.",
    exampleResponses: [
      "You've been doing exactly what you were asked, and it feels like no one's actually listening.",
      "You're worn out from raising the same problems and getting nowhere.",
    ],
  },
  {
    id: "drill-engaging-03",
    setting: "workplace",
    skill: "engaging",
    level: 3,
    context: "A new nurse manager, meeting a veteran nurse for the first time",
    speaker: "Veteran nurse",
    prompt: "I've had four managers in six years. No offense, but I'll believe things are changing when I see it.",
    instruction: "Respond in a way that shows you heard them and invites them to tell you what matters to them.",
    exampleResponses: [
      "Fair enough. You've seen a lot of people come through with big promises. What would you want a manager to get right this time?",
      "You've earned some skepticism. What's been most frustrating about all that turnover?",
    ],
  },

  // -------------------------------------------------------------------------
  // Focusing
  // -------------------------------------------------------------------------
  {
    id: "drill-focusing-01",
    setting: "workplace",
    skill: "focusing",
    level: 1,
    context: "A team lead, opening a one-on-one with a scheduler",
    speaker: "Scheduler",
    prompt: "So what did you want to talk about?",
    instruction: "Which opening shares the agenda and still leaves room for theirs?",
    choices: [
      {
        text: "We need to talk about the double-bookings. That's the whole meeting.",
        isTarget: false,
        explanation: "Clear, but it leaves no room for what's on their mind, which may be connected.",
      },
      {
        text: "I wanted to talk about the double-bookings from last week. Before we do, is there anything you want to make sure we cover?",
        isTarget: true,
        explanation: "You're honest about your topic and you invite theirs. That's shared agenda setting.",
      },
      {
        text: "Oh, nothing big, just checking in.",
        isTarget: false,
        explanation: "Hiding the real topic tends to backfire when it comes up later.",
      },
    ],
    exampleResponses: [
      "I wanted to talk about the double-bookings from last week. Before we do, is there anything you want to make sure we cover?",
    ],
  },
  {
    id: "drill-focusing-02",
    setting: "workplace",
    skill: "focusing",
    level: 2,
    context: "A clinic manager, during a check-in that's drifted to small talk",
    speaker: "Medical assistant",
    prompt: "Anyway, my daughter's soccer team made the finals, so that's been our whole weekend.",
    instruction: "Ask permission to raise a work topic (the late chart notes) without abruptly changing the subject.",
    exampleResponses: [
      "That's exciting, congratulations to her. Would it be okay if we spent a few minutes on chart notes? I'd like to hear how that's been going for you.",
      "Sounds like a big weekend. I did want to touch on the chart notes today. Is now an okay time?",
    ],
  },
  {
    id: "drill-focusing-03",
    setting: "workplace",
    skill: "focusing",
    level: 3,
    context: "A department director, with a supervisor who lists several concerns at once",
    speaker: "Supervisor",
    prompt: "Honestly, it's everything. The staffing, the new metrics, two people who don't get along, and I still haven't done half my reviews.",
    instruction: "Reflect the load, then help them choose where to start.",
    exampleResponses: [
      "That's a lot landing on you at once: staffing, metrics, a team conflict, and reviews. If we picked one to focus on today, which would make the biggest difference?",
      "Everything's pulling at you. Of those four, which one is keeping you up at night?",
    ],
  },
  {
    id: "drill-focusing-04",
    setting: "workplace",
    skill: "focusing",
    level: 2,
    context: "A nurse manager, with a nurse who asked about the new float policy",
    speaker: "Staff nurse",
    prompt: "Nobody explained how the float pool rotation actually works. Is it by seniority or not?",
    instruction: "Before giving the information, find out what they already know or have heard.",
    exampleResponses: [
      "Happy to walk through it. What have you heard so far?",
      "Good question. Before I explain, what's your understanding of how it works right now?",
    ],
  },

  // -------------------------------------------------------------------------
  // Evoking
  // -------------------------------------------------------------------------
  {
    id: "drill-evoking-01",
    setting: "workplace",
    skill: "evoking",
    level: 1,
    context: "A clinic manager, talking with a provider who often runs late",
    speaker: "Provider",
    prompt:
      "Running behind is just how primary care works. I've been doing it this way for twelve years. I hate that my last patients of the day always get the rushed version of me, though. I could probably block the first slot after lunch for catch-up.",
    instruction: "Which parts of what they said are change talk?",
    choices: [
      {
        text: "Running behind is just how primary care works.",
        isTarget: false,
        explanation: "This argues for things staying the same, so it's sustain talk.",
      },
      {
        text: "I hate that my last patients of the day always get the rushed version of me.",
        isTarget: true,
        explanation: "A reason for change: they don't like what running late does to patient care.",
      },
      {
        text: "I've been doing it this way for twelve years.",
        isTarget: false,
        explanation: "This leans toward the status quo. It's sustain talk, even though it's said calmly.",
      },
      {
        text: "I could probably block the first slot after lunch for catch-up.",
        isTarget: true,
        explanation: "Ability language. They're naming something they could do differently.",
      },
    ],
    exampleResponses: [
      "I hate that my last patients of the day always get the rushed version of me.",
      "I could probably block the first slot after lunch for catch-up.",
    ],
  },
  {
    id: "drill-evoking-02",
    setting: "workplace",
    skill: "evoking",
    level: 1,
    context: "A team lead, with an analyst who has been missing deadlines",
    speaker: "Analyst",
    prompt: "I want to get back to where I was last year. I was actually good at this.",
    instruction: "What kind of change talk is this?",
    choices: [
      {
        text: "Desire",
        isTarget: true,
        explanation: "\"I want to get back\" is a desire statement. The line about being good at it also hints at ability.",
      },
      {
        text: "Commitment",
        isTarget: false,
        explanation: "Commitment sounds like \"I will\" or \"I'm going to.\" This is a wish, not a promise yet.",
      },
      {
        text: "Sustain talk",
        isTarget: false,
        explanation: "Nothing here argues for staying the same. It leans toward change.",
      },
    ],
    exampleResponses: ["Desire"],
  },
  {
    id: "drill-evoking-03",
    setting: "workplace",
    skill: "evoking",
    level: 2,
    context: "A revenue cycle manager, mid-conversation about missed deadlines",
    speaker: "Analyst",
    prompt: "I mean, I know the team can't close the month without my reports. I don't love being the bottleneck.",
    instruction: "Reflect the change talk so they hear it again in your words.",
    exampleResponses: [
      "You don't want to be the one holding the team up.",
      "Your work matters to everyone's month-end, and you care about that.",
    ],
  },
  {
    id: "drill-evoking-04",
    setting: "workplace",
    skill: "evoking",
    level: 3,
    context: "A clinic director, with a provider who has mixed feelings about charting after hours",
    speaker: "Provider",
    prompt: "I finish notes at home most nights. It's fine. It's what everyone does.",
    instruction: "Ask an open question that invites them to talk about why change might matter to them.",
    exampleResponses: [
      "What does charting at night take away from you?",
      "If your evenings looked different a year from now, what would you hope would be true?",
    ],
  },
  {
    id: "drill-evoking-05",
    setting: "workplace",
    skill: "evoking",
    level: 4,
    context: "A team lead, after raising a repeated documentation issue",
    speaker: "Employee",
    prompt: "I understand why you're asking me to change this, but I honestly don't think it's a big deal.",
    instruction: "Respond to the sustain talk without arguing. Try a double-sided reflection that ends on the side leaning toward change.",
    exampleResponses: [
      "From where you sit it doesn't seem like a big deal, and you also get why I'm raising it.",
      "It doesn't feel important to you, and at the same time you can see where I'm coming from.",
    ],
  },
  {
    id: "drill-evoking-06",
    setting: "workplace",
    skill: "evoking",
    level: 3,
    context: "A nurse manager, with a nurse who keeps skipping breaks",
    speaker: "Staff nurse",
    prompt: "If I take my break, my patients get stuck with whoever's covering. I'd rather just push through.",
    instruction: "Ask a looking-forward question that helps them consider what happens if nothing changes.",
    exampleResponses: [
      "If you keep pushing through like this for the next six months, how do you see that going?",
      "Imagine it's next spring and nothing about breaks has changed. What would that be like for you?",
    ],
  },

  // -------------------------------------------------------------------------
  // Change talk
  // -------------------------------------------------------------------------
  {
    id: "drill-change-talk-01",
    setting: "workplace",
    skill: "change-talk",
    level: 1,
    context: "A practice manager, near the end of a check-in with a front desk lead",
    speaker: "Front desk lead",
    prompt:
      "I should really start the huddles on time. I could probably get people there earlier. I'd like huddles to feel less chaotic. Okay. Starting on Monday, I'm going to open huddles at 7:45 sharp.",
    instruction: "Which part of what they said is commitment language?",
    choices: [
      {
        text: "I should really start the huddles on time.",
        isTarget: false,
        explanation: "\"Should\" points to need. It leans toward change but isn't a commitment.",
      },
      {
        text: "Starting on Monday, I'm going to open huddles at 7:45 sharp.",
        isTarget: true,
        explanation: "\"I'm going to\" plus a specific time. That's commitment.",
      },
      {
        text: "I could probably get people there earlier.",
        isTarget: false,
        explanation: "\"Could\" is ability language. It's change talk, but not commitment yet.",
      },
      {
        text: "I'd like huddles to feel less chaotic.",
        isTarget: false,
        explanation: "Desire language. A real step toward change, still short of a commitment.",
      },
    ],
    exampleResponses: ["Starting on Monday, I'm going to open huddles at 7:45 sharp."],
  },
  {
    id: "drill-change-talk-02",
    setting: "workplace",
    skill: "change-talk",
    level: 2,
    context: "A department lead, talking with a coordinator about missed follow-ups",
    speaker: "Care coordinator",
    prompt: "It's not like I'm ignoring them. I just get buried. Although, yeah, Mr. Patel waiting two weeks for a callback wasn't okay.",
    instruction: "Reflect the change talk in this mixed statement. Let the sustain part go by.",
    exampleResponses: [
      "That two-week wait for Mr. Patel really bothers you.",
      "You don't want patients waiting that long to hear back.",
    ],
  },
  {
    id: "drill-change-talk-03",
    setting: "workplace",
    skill: "change-talk",
    level: 3,
    context: "A clinic supervisor, after an MA mentions wanting to feel more on top of things",
    speaker: "Medical assistant",
    prompt: "I'd like to not be scrambling every morning. I just don't know how.",
    instruction: "Ask for elaboration on the change talk. Get them to say more about the 'not scrambling' part.",
    exampleResponses: [
      "What would a morning look like if you weren't scrambling?",
      "Tell me more about what you'd want those mornings to feel like.",
    ],
  },

  // -------------------------------------------------------------------------
  // Sustain talk
  // -------------------------------------------------------------------------
  {
    id: "drill-sustain-talk-01",
    setting: "workplace",
    skill: "sustain-talk",
    level: 1,
    context: "A team lead, discussing late reports with an analyst",
    speaker: "Analyst",
    prompt:
      "I don't want people thinking I'm unreliable. But nobody reads those reports until the 10th anyway. And I've got too much on my plate to fix the template right now. What day is the close this month?",
    instruction: "Which parts of what they said are sustain talk?",
    choices: [
      {
        text: "Nobody reads those reports until the 10th anyway.",
        isTarget: true,
        explanation: "A reason the current pattern is fine. That's sustain talk.",
      },
      {
        text: "I don't want people thinking I'm unreliable.",
        isTarget: false,
        explanation: "This is a reason to change, so it's change talk.",
      },
      {
        text: "I've got too much on my plate to fix the template right now.",
        isTarget: true,
        explanation: "An inability reason (\"can't right now\"). That's sustain talk too.",
      },
      {
        text: "What day is the close this month?",
        isTarget: false,
        explanation: "A neutral question. It doesn't lean either way.",
      },
    ],
    exampleResponses: [
      "Nobody reads those reports until the 10th anyway.",
      "I've got too much on my plate to fix the template right now.",
    ],
  },
  {
    id: "drill-sustain-talk-02",
    setting: "workplace",
    skill: "sustain-talk",
    level: 2,
    context: "A clinic manager, with an MA who skips the pre-visit checklist",
    speaker: "Medical assistant",
    prompt: "The checklist takes forever and half of it doesn't apply to our patients.",
    instruction: "Reflect the sustain talk without arguing, correcting, or adding a 'but'.",
    exampleResponses: [
      "A lot of the checklist feels like wasted time with the patients you see.",
      "It doesn't fit the way your visits actually go.",
    ],
  },
  {
    id: "drill-sustain-talk-03",
    setting: "workplace",
    skill: "sustain-talk",
    level: 3,
    context: "A nurse manager, with a nurse resisting bedside shift report",
    speaker: "Staff nurse",
    prompt: "Bedside report wakes patients up and drags on. But I guess families do like being included.",
    instruction: "Respond with a double-sided reflection. Put the change side last.",
    exampleResponses: [
      "It can disrupt patients and take longer, and you've also seen families appreciate being part of it.",
      "On one hand it slows things down; on the other, families feel more included.",
    ],
  },
  {
    id: "drill-sustain-talk-04",
    setting: "workplace",
    skill: "sustain-talk",
    level: 4,
    context: "A revenue cycle manager, third conversation about missed deadlines",
    speaker: "Analyst",
    prompt: "Look, I've heard this already. The deadlines are arbitrary and I still get the work done eventually.",
    instruction: "Respond in a way that emphasizes their autonomy and doesn't push. No advice yet.",
    exampleResponses: [
      "You're the one who knows your workload best, and it's your call how you approach this. I'm interested in what you think would make the deadlines feel less arbitrary.",
      "You've heard it before, and you don't need another lecture. How you handle this is up to you.",
    ],
  },

  // -------------------------------------------------------------------------
  // Discord
  // -------------------------------------------------------------------------
  {
    id: "drill-discord-01",
    setting: "workplace",
    skill: "discord",
    level: 1,
    context: "A director, talking with a charge nurse about a new staffing model",
    speaker: "Charge nurse",
    prompt:
      "The new model doesn't work on nights. I'm not sure we have the people to make it work. And honestly? You've never worked a night shift. You don't get to tell me how this goes.",
    instruction: "Which part signals discord (tension with you) rather than sustain talk?",
    choices: [
      {
        text: "The new model doesn't work on nights.",
        isTarget: false,
        explanation: "This is about the change itself, not about you. It's sustain talk.",
      },
      {
        text: "You've never worked a night shift. You don't get to tell me how this goes.",
        isTarget: true,
        explanation: "This is aimed at you and the relationship. That's discord.",
      },
      {
        text: "I'm not sure we have the people to make it work.",
        isTarget: false,
        explanation: "A concern about ability. Still sustain talk, and said without hostility.",
      },
    ],
    exampleResponses: ["You've never worked a night shift. You don't get to tell me how this goes."],
  },
  {
    id: "drill-discord-02",
    setting: "workplace",
    skill: "discord",
    level: 2,
    context: "A clinic manager, after raising a pattern of late arrivals",
    speaker: "Front desk associate",
    prompt: "So you've been tracking when I come in? That's great. Really makes me feel trusted.",
    instruction: "Reflect what they're feeling without defending yourself or explaining.",
    exampleResponses: [
      "It feels like you're being watched instead of trusted.",
      "This landed as me keeping score on you.",
    ],
  },
  {
    id: "drill-discord-03",
    setting: "workplace",
    skill: "discord",
    level: 3,
    context: "A team lead, after jumping in with solutions too quickly",
    speaker: "Billing specialist",
    prompt: "I didn't ask you to fix it. I was just telling you what happened.",
    instruction: "Lower the tension. Try a brief apology or a shift in focus, then invite them to continue.",
    exampleResponses: [
      "You're right, I jumped ahead. I'd like to hear the rest of what happened.",
      "Sorry, that wasn't what you needed. Go on, I'm listening.",
    ],
  },
  {
    id: "drill-discord-04",
    setting: "workplace",
    skill: "discord",
    level: 4,
    context: "A department director, with a veteran nurse angry about a policy change",
    speaker: "Veteran nurse",
    prompt: "This is another decision made by people in suits who've never touched a patient. And now you want me to sell it to my team?",
    instruction: "Respond in a way that emphasizes their autonomy and reflects the frustration. Don't defend the policy.",
    exampleResponses: [
      "You're tired of being handed decisions you had no part in, and you don't want to stand in front of your team pretending to agree. How you talk to them about it is your call.",
      "It feels like you're being asked to carry something you didn't choose. I'm not going to tell you what to say to your team.",
    ],
  },

  // -------------------------------------------------------------------------
  // Planning
  // -------------------------------------------------------------------------
  {
    id: "drill-planning-01",
    setting: "workplace",
    skill: "planning",
    level: 1,
    context: "A clinic supervisor, late in a conversation about room turnover",
    speaker: "Medical assistant",
    prompt:
      "I don't know. It's complicated. It's really the providers who slow us down. Okay. So what would I even do first?",
    instruction: "Which part suggests they may be ready to talk about a plan?",
    choices: [
      {
        text: "I don't know. It's complicated.",
        isTarget: false,
        explanation: "Still weighing things. Planning now would likely feel rushed.",
      },
      {
        text: "Okay. So what would I even do first?",
        isTarget: true,
        explanation: "They're asking about steps. That's a sign of readiness to plan.",
      },
      {
        text: "It's really the providers who slow us down.",
        isTarget: false,
        explanation: "Sustain talk. Moving to a plan here would skip their concern.",
      },
    ],
    exampleResponses: ["Okay. So what would I even do first?"],
  },
  {
    id: "drill-planning-02",
    setting: "workplace",
    skill: "planning",
    level: 2,
    context: "A team lead, after an analyst says they want to stop missing deadlines",
    speaker: "Analyst",
    prompt: "I don't want to keep having this conversation. I need to get my reports in on time.",
    instruction: "Ask a key question that invites them to name a next step, without suggesting one.",
    exampleResponses: [
      "So where does that leave you? What do you think you'll do?",
      "What feels like a good first step from here?",
    ],
  },
  {
    id: "drill-planning-03",
    setting: "workplace",
    skill: "planning",
    level: 3,
    context: "A nurse manager, planning with a nurse who wants to delegate more",
    speaker: "Charge nurse",
    prompt: "I guess I could hand off the supply orders to Jamal. He's asked for more responsibility.",
    instruction: "Help them build the plan in their own words. Ask about the specifics: when, how, what might get in the way.",
    exampleResponses: [
      "That sounds like a good fit. How would you want to hand it off to him?",
      "What would you need to show Jamal so you'd feel okay letting go of it?",
    ],
  },

  // -------------------------------------------------------------------------
  // Leadership
  // -------------------------------------------------------------------------
  {
    id: "drill-leadership-01",
    setting: "workplace",
    skill: "leadership",
    level: 1,
    context: "A clinic director, addressing a non-negotiable infection control requirement",
    speaker: "Medical assistant",
    prompt: "Do I really have to do the full wipe-down between every patient? It's so slow.",
    instruction: "Which response is clear about the requirement and still MI-consistent?",
    choices: [
      {
        text: "It's policy. I don't make the rules.",
        isTarget: false,
        explanation: "Clear, but it distances you and ends the conversation.",
      },
      {
        text: "Totally optional, do what feels right.",
        isTarget: false,
        explanation: "Kind, but not honest. Being MI-consistent doesn't mean dropping real expectations.",
      },
      {
        text: "The full wipe-down is required, and I hear that it slows you down. What would make it easier to fit into your flow?",
        isTarget: true,
        explanation: "You name the expectation plainly, reflect their concern, and invite their ideas on how.",
      },
    ],
    exampleResponses: [
      "The full wipe-down is required, and I hear that it slows you down. What would make it easier to fit into your flow?",
    ],
  },
  {
    id: "drill-leadership-02",
    setting: "workplace",
    skill: "leadership",
    level: 3,
    context: "A revenue cycle manager, sharing a firm deadline",
    speaker: "Analyst",
    prompt: "So what exactly do you need from me?",
    instruction: "Share the expectation (reports by the 3rd business day) clearly, then hand the 'how' back to them.",
    exampleResponses: [
      "I need the month-end reports by the third business day. How you get there is up to you. What would make that doable?",
      "The firm piece is the third business day. Beyond that, I'd like to hear how you'd want to approach it.",
    ],
  },
  {
    id: "drill-leadership-03",
    setting: "workplace",
    skill: "leadership",
    level: 4,
    context: "A department lead, when an employee wants to be told what to do",
    speaker: "Scheduler",
    prompt: "Can you just tell me what you want me to do? I don't need a whole conversation about it.",
    instruction: "Respect the request. Offer information or a suggestion with their permission and keep their choice in it.",
    exampleResponses: [
      "Fair. I do have a couple of ideas. Want to hear them, and you can tell me which ones would actually work?",
      "Sure. Here's what I'd suggest, and you know the schedule better than I do, so tell me if it doesn't fit.",
    ],
  },

  // -------------------------------------------------------------------------
  // Full conversation
  // -------------------------------------------------------------------------
  {
    id: "drill-full-conversation-01",
    setting: "workplace",
    skill: "full-conversation",
    level: 4,
    context: "A practice manager, near the end of a long conversation with a front desk lead",
    speaker: "Front desk lead",
    prompt:
      "So, I don't love the new check-in process, and I think it's going to confuse our older patients. But I see why we need it, and honestly the paper forms are a mess.",
    instruction: "Offer a transitional summary that gathers both sides and checks whether they're ready to talk next steps.",
    exampleResponses: [
      "You're worried the new process will be hard for older patients, and you also see the paper forms aren't working. You get why it matters. Where would you like to go from here?",
    ],
  },
  // MI for Clinicians drills live in drills-clinicians.ts.
  // -------------------------------------------------------------------------
  // Overview and eliciting (8-week restructure)
  // -------------------------------------------------------------------------
  {
    id: "drill-righting-reflex-01",
    setting: "workplace",
    skill: "engaging",
    level: 1,
    context: "A nurse manager, with a nurse who has been late to shift handoff three times this month",
    speaker: "Nurse",
    prompt: "I know, I know. Traffic has been brutal and daycare drop-off keeps running late.",
    instruction: "Which response comes from the righting reflex, and which comes from curiosity? Pick the curious one.",
    choices: [
      {
        text: "Have you tried leaving fifteen minutes earlier?",
        isTarget: false,
        explanation: "A helpful idea, but it jumps to fixing before you understand. That's the righting reflex.",
      },
      {
        text: "Handoff is when patient safety is most at risk. You need to be on time.",
        isTarget: false,
        explanation: "True, and it may need saying, but leading with it invites defensiveness.",
      },
      {
        text: "Mornings have been a real juggle lately. What's that been like for you?",
        isTarget: true,
        explanation: "You reflect what they said and get curious. Now they can tell you what's really going on.",
      },
    ],
    exampleResponses: [
      "Mornings have been a real juggle lately. What's that been like for you?",
    ],
  },
  {
    id: "drill-evoking-ruler-01",
    setting: "workplace",
    skill: "evoking",
    level: 1,
    context: "A supervisor, using the importance ruler with an analyst who keeps missing report deadlines",
    speaker: "Analyst",
    prompt: "Getting them in on time? I don't know. Maybe a 5.",
    instruction: "They rated importance a 5 out of 10. Which follow-up is most likely to draw out change talk?",
    choices: [
      {
        text: "Why a 5 and not a 2?",
        isTarget: true,
        explanation: "To answer, they have to say why it matters to them at all. Their answer is their own reasons for change.",
      },
      {
        text: "Why only a 5? It should be a 10.",
        isTarget: false,
        explanation: "This invites them to defend the low number, which draws out sustain talk.",
      },
      {
        text: "What would make it a 10?",
        isTarget: false,
        explanation: "Not bad, but it skips the reasons they already have. Start with why it isn't lower.",
      },
    ],
    exampleResponses: [
      "Why a 5 and not a 2?",
    ],
  },
  {
    id: "drill-evoking-ruler-02",
    setting: "workplace",
    skill: "evoking",
    level: 2,
    context: "A high school coach, with a point guard who says he wants to be a better teammate but doubts he can",
    speaker: "Athlete",
    prompt: "Confidence I can actually do it? Like a 3. I just get heated when people mess up.",
    instruction: "Respond with a question that draws out his confidence, building on the 3.",
    exampleResponses: [
      "What makes it a 3 and not a 0?",
      "A 3 means there's something there. What would it take to move it to a 4?",
      "When have you kept your cool with a teammate, even once?",
    ],
  },
  ...CLINICIAN_DRILLS,
];

/**
 * A sensible daily sequence: recognize before respond, OARS before evoking.
 * This is the MI for Leaders order; use dailyDrillOrder(pathwayId) for others.
 */
export const DAILY_DRILL_ORDER: string[] = [
  "drill-oars-01",
  "drill-oars-02",
  "drill-oars-03",
  "drill-oars-04",
  "drill-oars-05",
  "drill-engaging-01",
  "drill-oars-06",
  "drill-engaging-02",
  "drill-focusing-01",
  "drill-oars-07",
  "drill-focusing-02",
  "drill-focusing-04",
  "drill-engaging-03",
  "drill-evoking-01",
  "drill-sustain-talk-01",
  "drill-evoking-02",
  "drill-focusing-03",
  "drill-evoking-03",
  "drill-change-talk-01",
  "drill-sustain-talk-02",
  "drill-change-talk-02",
  "drill-discord-01",
  "drill-evoking-04",
  "drill-discord-02",
  "drill-change-talk-03",
  "drill-sustain-talk-03",
  "drill-leadership-01",
  "drill-evoking-06",
  "drill-evoking-05",
  "drill-planning-01",
  "drill-discord-03",
  "drill-planning-02",
  "drill-leadership-02",
  "drill-sustain-talk-04",
  "drill-planning-03",
  "drill-discord-04",
  "drill-leadership-03",
  "drill-full-conversation-01",
];

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** Daily drill sequence per pathway. */
export const DAILY_DRILL_ORDER_BY_PATHWAY: Record<PathwayId, string[]> = {
  "mi-for-leaders": DAILY_DRILL_ORDER,
  "mi-for-clinicians": CLINICIAN_DAILY_DRILL_ORDER,
};

/** The daily drill sequence for a pathway; unknown ids fall back to MI for Leaders. */
export function dailyDrillOrder(pathwayId: PathwayId | string | null | undefined): string[] {
  return (pathwayId && DAILY_DRILL_ORDER_BY_PATHWAY[pathwayId as PathwayId]) || DAILY_DRILL_ORDER;
}

/** Every drill written for a setting (workplace or clinical). */
export function drillsForSetting(setting: Setting): Drill[] {
  return DRILLS.filter((d) => d.setting === setting);
}
