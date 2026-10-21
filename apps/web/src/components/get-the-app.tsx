import Link from "next/link";
import type { ReactNode } from "react";
import { appHref, ctaTrack, pilotLink, TRAINER_PATH, type Audience } from "@/lib/site";

type Size = "sm" | "md" | "lg";

type Variant = "primary" | "secondary";

const sizes: Record<Size, string> = {
  // 36 px tall; the invisible ::before grows the tap target to 44 px.
  sm: "relative px-4 py-2 text-[13px] active:translate-y-1 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
  md: "px-5 py-3 text-[15px] active:translate-y-1.5",
  lg: "px-6 py-4 text-base active:translate-y-1.5",
};

const variants: Record<Variant, Record<Size, string>> = {
  primary: {
    sm: "bg-primary text-primary-ink shadow-[0_4px_0_var(--primary-shadow)] hover:brightness-105 active:shadow-[0_0_0_var(--primary-shadow)]",
    md: "bg-primary text-primary-ink shadow-[0_6px_0_var(--primary-shadow)] hover:brightness-105 active:shadow-[0_0_0_var(--primary-shadow)]",
    lg: "bg-primary text-primary-ink shadow-[0_6px_0_var(--primary-shadow)] hover:brightness-105 active:shadow-[0_0_0_var(--primary-shadow)]",
  },
  secondary: {
    sm: "border-2 border-line bg-white text-ink shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint active:shadow-[0_0_0_var(--shadow)]",
    md: "border-2 border-line bg-white text-ink shadow-[0_6px_0_var(--shadow)] hover:border-primary-tint active:shadow-[0_0_0_var(--shadow)]",
    lg: "border-2 border-line bg-white text-ink shadow-[0_6px_0_var(--shadow)] hover:border-primary-tint active:shadow-[0_0_0_var(--shadow)]",
  },
};

export const buttonBase =
  "inline-flex max-w-full shrink-0 items-center justify-center rounded-2xl text-center font-extrabold uppercase tracking-wide transition-[transform,filter,box-shadow,border-color] duration-75 ease-out";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type GetTheAppProps = {
  /** CTA location for `?src=` and `data-track-location` (hero, nav, download_band, ...). */
  location: string;
  audience?: Audience;
  size?: Size;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
  /** Overrides the link, for a deep link into the app (it must still carry `?src=`). */
  href?: string;
};

/** The primary CTA: opens the learner app in the browser. */
export function GetTheApp({
  location,
  audience,
  size = "md",
  variant = "primary",
  className = "",
  children = "Start practicing free",
  href,
}: GetTheAppProps) {
  return (
    <a
      href={href ?? appHref(location)}
      {...ctaTrack(location, "app", audience)}
      data-mascot-watch
      data-mascot-celebrate
      className={`${buttonBase} ${focus} ${sizes[size]} ${variants[variant][size]} ${className}`}
    >
      {children}
    </a>
  );
}

/** The quiet line under a primary CTA. */
export function CtaNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm font-bold text-muted ${className}`}>
      Free for learners · Runs in your browser
    </p>
  );
}

type TrainerCtaProps = {
  location: string;
  audience?: Audience;
  size?: Size;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
};

/** Secondary CTA for trainers: the dashboard at /trainer. */
export function TrainerCta({
  location,
  audience = "trainers",
  size = "md",
  variant = "secondary",
  className = "",
  children = "Open the trainer dashboard",
}: TrainerCtaProps) {
  return (
    <Link
      href={TRAINER_PATH}
      prefetch={false}
      {...ctaTrack(location, "trainer", audience)}
      className={`${buttonBase} ${focus} ${sizes[size]} ${variants[variant][size]} ${className}`}
    >
      {children}
    </Link>
  );
}

type PilotCtaProps = {
  location: string;
  size?: Size;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
};

/** Book a pilot call (Calendly, new tab). Tracked as `target: pilot`. */
export function PilotCta({
  location,
  size = "md",
  variant = "primary",
  className = "",
  children = "Book a 30-minute call",
}: PilotCtaProps) {
  return (
    <a
      {...pilotLink(location)}
      className={`${buttonBase} ${focus} ${sizes[size]} ${variants[variant][size]} ${className}`}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
