import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CheckIcon, LockSimpleIcon, MinusIcon } from './icons';
import { Text } from './Text';
import { border, color, font, radius } from './tokens';

export type StepBadgeState = 'level' | 'done' | 'locked' | 'letter' | 'selected' | 'target' | 'miss';

export interface StepBadgeProps {
  /** `square` (rounded, radius.badge) for levels and progress, `pill` (round) for choices and checks. */
  shape: 'square' | 'pill';
  /**
   * level: cobalt numeral on soft. done / target: navy check on ochre (white on ochre is 2.1:1).
   * locked: faint lock. letter: muted letter on white. selected: white letter on cobalt.
   * miss: terracotta dash on its tint (a pick that wasn't what the drill asked; never a red X).
   */
  state: StepBadgeState;
  /** The numeral (level) or letter (letter, selected). */
  label?: string | number;
  /** 32 everywhere except dense rows (the assignment check is 24). */
  size?: number;
  /** Replaces the state's glyph (e.g. an animated check). */
  glyph?: ReactNode;
  /** Animated styles welcome (a pop on change); the root is an Animated.View. */
  style?: ComponentProps<typeof Animated.View>['style'];
  children?: ReactNode;
}

const LOOK: Record<StepBadgeState, { face: string; edge: string; ink: string }> = {
  level: { face: color.soft, edge: color.primaryTint, ink: color.primary },
  done: { face: color.gold, edge: color.goldShadow, ink: color.navy },
  target: { face: color.gold, edge: color.goldShadow, ink: color.navy },
  locked: { face: color.white, edge: color.line, ink: color.faint },
  letter: { face: color.white, edge: color.line, ink: color.muted },
  selected: { face: color.primary, edge: color.primaryShadow, ink: color.white },
  miss: { face: color.missTint, edge: color.miss, ink: color.missInk },
};

/**
 * The 32pt step marker: a skill level on Home, a choice letter in a drill, a
 * check on an assignment. One footprint, seven states, two shapes.
 */
export function StepBadge({ shape, state, label, size = 32, glyph, style, children }: StepBadgeProps) {
  const look = LOOK[state];
  const content =
    glyph !== undefined ? (
      glyph
    ) : state === 'done' || state === 'target' ? (
      <CheckIcon size={16} weight="bold" color={look.ink} />
    ) : state === 'miss' ? (
      <MinusIcon size={16} weight="bold" color={look.ink} />
    ) : state === 'locked' ? (
      <LockSimpleIcon size={15} weight="bold" color={look.ink} />
    ) : label === undefined ? null : state === 'level' ? (
      <Text variant="caption" color={look.ink} style={styles.numeral} maxScale={1}>
        {label}
      </Text>
    ) : (
      <Text variant="label" color={look.ink}>
        {label}
      </Text>
    );
  return (
    <Animated.View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: shape === 'pill' ? size / 2 : radius.badge, backgroundColor: look.face, borderColor: look.edge },
        style,
      ]}
    >
      {content}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: border },
  numeral: { fontFamily: font.display, fontSize: 15 },
});
