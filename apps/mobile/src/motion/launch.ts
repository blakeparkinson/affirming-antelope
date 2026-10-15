import type { RefObject } from 'react';
import type { TextStyle, View } from 'react-native';

/**
 * Launch registry for continuity transitions into practice screens.
 *
 * A source (Home's daily rep card, a Practice skill tile) measures
 * itself, registers a `Launch`, then navigates. The destination's
 * `SessionSurface` takes it once on mount and expands from that rect. Pieces
 * of the source (its title, its START button) fly to named targets in the
 * destination (`HeroTarget name="title" | "cta"`).
 *
 * Practice screens are transparent modals with no native animation, so every
 * frame of the transition is ours (Reanimated, UI thread) and the source stays
 * visible underneath for the collapse on close.
 */
export type Rect = { x: number; y: number; width: number; height: number };

export type HeroName = 'title' | 'cta';

export interface HeroPiece {
  rect: Rect;
  /** Text proxy (title). */
  text?: string;
  textStyle?: TextStyle;
  /** Surface proxy (cta): face colour and corner radius. */
  face?: string;
  radius?: number;
  /** Label on the source control, fading out as the surface morphs. */
  label?: string;
  labelStyle?: TextStyle;
}

export interface Launch {
  kind: 'hero' | 'replace';
  rect: Rect;
  face: string;
  radius: number;
  pieces: Partial<Record<HeroName, HeroPiece>>;
  /** Re-measured on close so the screen can collapse back into it. */
  source?: RefObject<View | null>;
  /** Bottom-shadow depth excluded from the source rect. */
  depth?: number;
  /** Header title for the destination, so the flying title has somewhere to land. */
  title?: string;
  at: number;
}

let pending: Launch | null = null;

/** Consumed once by the destination. Stale launches (navigation never happened) are ignored. */
export function takeLaunch(): Launch | null {
  const l = pending;
  pending = null;
  if (!l || Date.now() - l.at > 1200) return null;
  return l;
}

export function setLaunch(l: Omit<Launch, 'at'>) {
  pending = { ...l, at: Date.now() };
}

export function measure(ref: RefObject<View | null> | undefined): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    let done = false;
    const t = setTimeout(() => !done && resolve(null), 120);
    node.measureInWindow((x, y, width, height) => {
      done = true;
      clearTimeout(t);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export interface HeroSource {
  container: RefObject<View | null>;
  /** Exclude a raised surface's bottom shadow from the container rect. */
  depth?: number;
  face: string;
  radius: number;
  title?: { ref: RefObject<View | null>; text: string; style: TextStyle };
  cta?: { ref: RefObject<View | null>; face: string; radius: number; label?: string; labelStyle?: TextStyle };
  /** What the destination header should say. Defaults to the title text. */
  headerTitle?: string;
}

/**
 * Measure a source and register the launch, then navigate. If measuring
 * fails, navigation still happens (the destination falls back to its rise).
 */
export async function launchFrom(src: HeroSource, go: () => void) {
  const [rect, title, cta] = await Promise.all([measure(src.container), measure(src.title?.ref), measure(src.cta?.ref)]);
  if (rect) {
    setLaunch({
      kind: 'hero',
      rect: { ...rect, height: rect.height - (src.depth ?? 0) },
      face: src.face,
      radius: src.radius,
      source: src.container,
      depth: src.depth,
      title: src.headerTitle ?? src.title?.text,
      pieces: {
        ...(title && src.title ? { title: { rect: title, text: src.title.text, textStyle: src.title.style } } : {}),
        ...(cta && src.cta ? { cta: { rect: cta, face: src.cta.face, radius: src.cta.radius, label: src.cta.label, labelStyle: src.cta.labelStyle } } : {}),
      },
    });
  }
  go();
}

/** One practice screen replacing another ("Try a harder scenario"): no reveal, a forward swap. */
export function markReplace() {
  setLaunch({ kind: 'replace', rect: { x: 0, y: 0, width: 0, height: 0 }, face: '#fff', radius: 0, pieces: {} });
}
