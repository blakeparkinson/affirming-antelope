import { SITE_URL } from "@/lib/site";

/**
 * The people named on the site. Only facts they have given us.
 */
/**
 * Whether to name a person's current employer (Headway, for Amanda) in copy and JSON-LD.
 * Amanda must approve employer naming before this ships. Set to false to remove every
 * mention of it: the sentence on her page and `worksFor` in her Person JSON-LD.
 */
export const showCurrentEmployer = true;

type Org = { name: string; url?: string };

export type Person = {
  slug: string;
  /** schema.org `name`, without the credential. */
  name: string;
  /** Credential, shown after the name and used as `honorificSuffix`. */
  credential?: string;
  /** Name as shown on the page, e.g. "Amanda Roth, LCSW". */
  displayName: string;
  jobTitle?: string;
  /** One line under the name (the name already carries "LCSW"), e.g. "Member, ..." */
  credentialLine?: string;
  /** Professional bodies, as schema.org `memberOf`. */
  memberOf?: Org[];
  /** Current employer. Only used when `showCurrentEmployer` is true. */
  employer?: Org;
  /** Path to a page about them, when there is one. */
  page?: string;
  photo?: { src: string; width: number; height: number; alt: string };
  sameAs: string[];
};

export const AMANDA: Person = {
  slug: "amanda-roth",
  name: "Amanda Roth",
  credential: "LCSW",
  displayName: "Amanda Roth, LCSW",
  jobTitle: "Principal, Psychotherapy Clinical Quality",
  credentialLine: "Member, Motivational Interviewing Network of Trainers (MINT)",
  memberOf: [
    { name: "Motivational Interviewing Network of Trainers", url: "https://motivationalinterviewing.org" },
    { name: "Association for Talent Development", url: "https://www.td.org" },
  ],
  employer: { name: "Headway" },
  page: "/about/amanda-roth",
  photo: { src: "/team/amanda-roth.jpg", width: 500, height: 500, alt: "Portrait of Amanda Roth, LCSW" },
  sameAs: ["https://www.linkedin.com/in/akbrownell/"],
};

export const BLAKE: Person = {
  slug: "blake-parkinson",
  name: "Blake Parkinson",
  displayName: "Blake Parkinson",
  jobTitle: "Head of Engineering",
  employer: { name: "Big Leap Health" },
  page: "/about/blake-parkinson",
  photo: {
    src: "/team/blake-parkinson-headshot.jpg",
    width: 400,
    height: 400,
    alt: "Portrait of Blake Parkinson",
  },
  sameAs: ["https://www.linkedin.com/in/bparky", "https://github.com/blakeparkinson", "https://www.yourbuddyblake.com"],
};

const PEOPLE: Person[] = [AMANDA, BLAKE];

export function getPerson(slug: string): Person | undefined {
  return PEOPLE.find((p) => p.slug === slug);
}

export function personId(p: Person) {
  return `${SITE_URL}${p.page ?? "/about"}#${p.slug}`;
}

/**
 * Amanda's bio in her own words, as she supplied it (only a comma-for-period
 * typo fixed). Don't rewrite it: changes go back to her.
 */
export function amandaBio(): string[] {
  return [
    "Amanda Roth is a seasoned strategic leader with over a decade of experience in clinical operations, quality improvement, and learning and development. She specializes in building efficient, scalable, and high-performing organizational processes. As a Licensed Clinical Social Worker and proud member of both the Motivational Interviewing Network of Trainers (MINT) and the Association for Talent Development (ATD), Amanda blends evidence-based coaching methodologies with instructional design expertise to drive workforce excellence and engagement.",
    "Recently, Amanda joined Headway as Principal, Psychotherapy Clinical Quality. Formerly, serving as Head of Quality at Two Chairs, Amanda oversees clinical learning, development, and quality assurance initiatives, leading a cross-functional team in implementing innovative training programs, auditing systems, and organizational improvement strategies. Prior to Two Chairs, Amanda held senior leadership roles at Calm and Vida Health, where they developed large-scale onboarding programs, designed key performance metrics, and led company-wide quality improvement efforts that elevated care outcomes and operational efficiency.",
    "Across roles at Vital Decisions, Vida Health, and Calm, Amanda has built a reputation for fostering a culture of learning and continuous improvement\u2014empowering clinicians, coaches, and leaders to achieve their highest potential. A recognized expert in Motivational Interviewing, Amanda has designed and scaled training programs that enhance provider communication, engagement, and performance organization-wide.",
    "Her kids have mastered sustain talk, ambivalence, and resistance to change without ever attending a single MI training.",
  ];
}

/**
 * Blake's bio, from his own site (yourbuddyblake.com/about) plus what he told us
 * directly (2026-10-19): his Big Leap Health role, Prime Menagerie LLC, and the Erie
 * Parks and Recreation Hall of Fame. Only facts he has given us.
 */
export function blakeBio(): string[] {
  return [
    "Blake Parkinson is Head of Engineering at Big Leap Health and a cofounder of Prime Menagerie LLC. He has written software for more than 20 years. Before Big Leap he ran engineering at Two Chairs, where his team built AI products that had to work under HIPAA.",
    "At Edmodo he built core infrastructure while the platform grew from 1 million users to 50 million, and learned several times that not everything that works at the first number works at the second. As CTO of Backbone PLM, he grew engineering from 3 people to more than 30. At four companies he has hired junior engineers and grown them to staff, and the good ones still email him about what they're working on.",
    "On Affirming Antelope, he builds the app and this site from Amanda's MI for Leaders program. He studied computer science and political science at the University of San Francisco, because he couldn't pick one. He once coached a soccer team through an undefeated season, was elected to the Erie Parks and Recreation Hall of Fame for it, and retired into the sunset.",
  ];
}

/** Blake's own words, from his site. */
export const BLAKE_QUOTE =
  "AI that has to work in production, in front of real users, in a regulated industry. The fun is making it boringly reliable.";

/**
 * Drafted for Amanda and approved by her (2026-10-13). Renders only when non-empty.
 * Shared by the home method block and her page.
 */
export const AMANDA_QUOTE =
  "A workshop can teach you what motivational interviewing is. Practice is what makes you do it. You get there by rehearsing the hard moments over and over, until reflecting comes before reacting.";
/**
 * A short note from the founders. Blake wrote this text; Amanda reads it before it ships.
 * Lives on /about.
 */
export const WHY_WE_BUILT: { heading: string; body: string[]; signedBy: string } = {
  heading: "Why we built this",
  body: [
    "Amanda has coached a lot of healthcare leaders through the conversations they dread: the late reports, the quiet team member, the change nobody asked for. The leaders she works with get better at them. But she can only sit in on so many one-on-ones.",
    "So we built a place to put everything she teaches. The 12-week path follows her MI for Leaders program, and every role-play is written to respond the way her learners’ employees do. Now people can practice her approach between sessions, on their own time.",
  ],
  signedBy: "Blake Parkinson",
};
