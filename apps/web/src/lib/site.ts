/**
 * Site-wide constants for the marketing site: URLs, names, and CTA link builders.
 * The CTA `data-track` contract lives in docs/tracking-plan.md.
 */

export const SITE_URL = "https://affirmingantelope.com";
export const APP_URL = "https://app.affirmingantelope.com";
export const SITE_NAME = "Affirming Antelope";
export const SITE_TAGLINE = "Motivational interviewing practice for leaders and clinicians";
export const SITE_DESCRIPTION =
  "Free motivational interviewing practice for supervisors, athletic coaches, nurses and more: five-minute drills and role-plays with simulated employees and athletes for performance, motivation, and burnout conversations, plus opt-in trainer review. Clinicians have their own pathway. Works in your browser.";

export type Audience = "clinicians" | "leaders" | "trainers";
export type CtaTarget = "app" | "trainer" | "pilot";

/** Trainer and team pilots: a 30-minute call with Blake. Opens in a new tab. */
export const PILOT_URL = "https://calendly.com/blake-bigleaphealth/30min";

/** The one pricing line, used wherever price comes up. No numbers until pilots set them. */
export const PRICING_LINE = "Free for learners. Cohort pilots for trainers and teams: book a 30-minute call.";

/** Learner app link that carries the CTA location as `?src=`. */
export function appHref(location: string, path = "/") {
  const url = new URL(path, APP_URL);
  url.searchParams.set("src", location);
  return url.toString();
}

/** Deep link into one drill, from a guide. */
export function drillHref(drillId: string, slug: string) {
  return appHref(`guide_${slug}`, `/drill/${encodeURIComponent(drillId)}`);
}

/** Deep link into one role-play, from its scenario page. The app route is /roleplay/[scenarioId]. */
export function roleplayHref(scenarioId: string) {
  return appHref(`scenario_${scenarioId}`, `/roleplay/${encodeURIComponent(scenarioId)}`);
}

export const TRAINER_PATH = "/trainer";

/** Props for a link to the pilot booking page, tracked as `target: pilot`. */
export function pilotLink(location: string) {
  return {
    href: PILOT_URL,
    target: "_blank",
    rel: "noopener",
    ...ctaTrack(location, "pilot"),
  } as const;
}

/** `data-track` attributes for a primary CTA (see docs/tracking-plan.md). */
export function ctaTrack(location: string, target: CtaTarget, audience?: Audience) {
  return {
    "data-track": "cta_clicked",
    "data-track-location": location,
    "data-track-target": target,
    ...(audience ? { "data-track-audience": audience } : {}),
  } as const;
}
