import Image from "next/image";
import type { ReactNode } from "react";
import { initials } from "@/lib/trainer/content";

// ---------------------------------------------------------------------------
// Buttons: the landing page's chunky 3D primary, plus calm secondary/ghost.
// Class helpers so the same look applies to <button>, <a> and <Link>.
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const focus =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-9 px-3.5 text-[13px] rounded-xl gap-1.5",
    md: "min-h-11 px-5 text-[14px] rounded-2xl gap-2",
    lg: "min-h-12 px-6 text-[15px] rounded-2xl gap-2",
  };
  const sm = size === "sm";
  const variants: Record<ButtonVariant, string> = {
    primary: sm
      ? "bg-primary text-primary-ink uppercase tracking-wide font-extrabold shadow-[0_3px_0_var(--primary-shadow)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_0_0_var(--primary-shadow)]"
      : "bg-primary text-primary-ink uppercase tracking-wide font-extrabold shadow-[0_4px_0_var(--primary-shadow)] hover:brightness-105 active:translate-y-[4px] active:shadow-[0_0_0_var(--primary-shadow)]",
    secondary: sm
      ? "bg-white text-ink font-extrabold border-2 border-line shadow-[0_3px_0_var(--shadow)] hover:bg-soft/60 active:translate-y-[3px] active:shadow-[0_0_0_var(--shadow)]"
      : "bg-white text-ink font-extrabold border-2 border-line shadow-[0_4px_0_var(--shadow)] hover:bg-soft/60 active:translate-y-[4px] active:shadow-[0_0_0_var(--shadow)]",
    ghost: "text-primary-shadow font-extrabold hover:bg-soft active:bg-soft-deep",
    danger: sm
      ? "bg-white text-[#a4472a] font-extrabold border-2 border-[#f0d3c6] shadow-[0_3px_0_#f0d3c6] hover:bg-[#fdf4f0] active:translate-y-[3px] active:shadow-none"
      : "bg-white text-[#a4472a] font-extrabold border-2 border-[#f0d3c6] shadow-[0_4px_0_#f0d3c6] hover:bg-[#fdf4f0] active:translate-y-[4px] active:shadow-none",
  };
  return [
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap transition-[transform,box-shadow,filter,background-color] duration-75 ease-out",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    sizes[size],
    variants[variant],
    focus,
    extra,
  ].join(" ");
}

export const focusRing = focus;

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  as: Tag = "section",
  depth = "lg",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside" | "li";
  depth?: "sm" | "md" | "lg";
} & Record<string, unknown>) {
  const d = { sm: "shadow-[0_3px_0_var(--shadow)]", md: "shadow-[0_4px_0_var(--shadow)]", lg: "shadow-[0_5px_0_var(--shadow)]" }[depth];
  return (
    <Tag className={`rounded-[20px] border-2 border-line bg-white ${d} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted ${className}`}>{children}</p>;
}

export function PageTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-[30px] font-bold leading-[1.1] tracking-tight text-ink ${className}`}>{children}</h1>;
}

export function SectionTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-[20px] font-bold leading-tight text-ink ${className}`}>
      {children}
    </h2>
  );
}

export type Tone = "neutral" | "primary" | "gold" | "teal" | "clay" | "navy";

const TONES: Record<Tone, string> = {
  neutral: "bg-soft text-ink",
  primary: "bg-primary-tint/60 text-primary-shadow",
  gold: "bg-gold-tint text-gold-ink",
  teal: "bg-[#e3f3f0] text-[#1f6b60]",
  clay: "bg-[#fbeee7] text-[#9a4a26]",
  navy: "bg-navy text-white",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-extrabold leading-5 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const AVATAR_TINTS = ["#c9d2fa", "#fbebcb", "#d5ece7", "#f6dccf", "#e2e7fc", "#e8e1f7"];

export function Avatar({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-navy ${className}`}
      style={{ width: size, height: size, background: AVATAR_TINTS[h % AVATAR_TINTS.length], fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
  pose = "wave",
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  pose?: "wave" | "celebrate";
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:text-left ${className}`}>
      <Image
        src={pose === "wave" ? "/brand-mascot-wave-cartoon-deep.png" : "/brand-mascot-celebrate-cartoon-deep.png"}
        alt=""
        width={674}
        height={978}
        className="h-32 w-auto shrink-0"
      />
      <div className="max-w-md">
        <h3 className="font-display text-[20px] font-bold text-ink">{title}</h3>
        {children ? <div className="mt-2 text-[15px] font-semibold leading-relaxed text-muted">{children}</div> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
