import { MI_FOR_LEADERS } from "@antelope/core";
import { PRICING_LINE } from "./site";

/** Home page FAQ. Rendered as the accordion and as FAQPage JSON-LD, so keep it plain text. */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Is what I say private?",
    a: "The scenarios are fictional, so leave out real names and identifying details. What you type or say becomes a transcript in your account, and the app doesn't store voice audio. If you join a cohort, your trainer sees what you've completed and reads only the sessions you choose to share. The full privacy policy is at primemenagerie.com/privacy.",
  },
  {
    q: "Do I need MI training first?",
    a: `No. It works best alongside MI training, and the ${MI_FOR_LEADERS.units.length}-week MI for Leaders path starts from the basics.`,
  },
  {
    q: "How is this different from asking ChatGPT to role-play?",
    a: `You get a ${MI_FOR_LEADERS.units.length}-week path, with a role-play each week from week 3. Each employee is written from a scenario spec, so Josh gets more defensive when you lecture and more open when you reflect. Feedback names the MI moves you made. If you're in a cohort, your trainer can read the sessions you send.`,
  },
  {
    q: "Can I say it out loud?",
    a: "Yes. On any role-play, hold to talk and say your reply. The employee answers in their own voice, and you can switch to typing at any point.",
  },
  {
    q: "What does it cost?",
    a: PRICING_LINE,
  },
  {
    q: "Is there an app?",
    a: "It works in your browser on any phone or laptop, with nothing to install. An iOS app is coming.",
  },
];
