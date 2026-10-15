import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Mascot, type MascotHandle, type MascotMood, type MascotPose } from '@/components/mascot';
import { Avatar, Bubble, Callout, QuotesIcon, TargetIcon, Text, border, color, space, type AvatarIdentity } from '@/design';
import { FADE_MS, spring, useFades, useListLayout, useReduceMotion } from '@/motion';
import { takeLaunchPad } from './Composer';
import { HeroTarget, useSession } from './SessionSurface';

// ---------------------------------------------------------------------------
// Bubble entrance: rises from the speaker's side with a soft overshoot.
// ---------------------------------------------------------------------------

export function useBubbleEntrance(side: 'left' | 'right', delay = 0, skip = false) {
  const reduce = useReduceMotion();
  const p = useSharedValue(skip ? 1 : 0);
  useEffect(() => {
    if (skip) return;
    p.value = reduce
      ? withDelay(delay, withTiming(1, { duration: FADE_MS }))
      : withDelay(delay, withSpring(1, { damping: 15, stiffness: 210, mass: 0.8 }));
  }, [p, reduce, delay, skip]);
  return useAnimatedStyle(() => {
    const v = p.value;
    if (reduce) return { opacity: v };
    return {
      opacity: Math.min(1, v * 1.6),
      transform: [{ translateY: (1 - v) * 18 }, { translateX: (1 - v) * (side === 'left' ? -10 : 10) }, { scale: 0.88 + 0.12 * v }],
    };
  });
}

// ---------------------------------------------------------------------------
// The learner's bubble launches out of the composer: it starts exactly where
// the words were in the field (left and bottom edges aligned, so the text
// lifts straight out), then springs to its place in the thread while the
// thread scrolls to meet it. Without a launch pad (history, opening line) it
// falls back to the speaker-side rise.
// ---------------------------------------------------------------------------

const LAUNCH = { damping: 20, stiffness: 250, mass: 0.85 };

export function useComposerLaunch(skip = false) {
  const reduce = useReduceMotion();
  const [pad] = useState(() => (skip ? null : takeLaunchPad()));
  const ref = useRef<View>(null);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const p = useSharedValue(skip ? 1 : 0);
  const shown = useSharedValue(skip || !pad ? 1 : 0);
  const s0 = useSharedValue(0.96);
  const fallback = useBubbleEntrance('right', 0, skip || !!pad);
  const measured = useRef(false);

  const onLayout = (_e: LayoutChangeEvent) => {
    if (!pad || measured.current) return;
    measured.current = true;
    if (reduce) {
      shown.value = 1;
      p.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    ref.current?.measureInWindow((x, y, w, h) => {
      if (pad.from === 'center') {
        // out of the mic: centre to centre, starting small
        dx.value = pad.x + pad.width / 2 - (x + w / 2);
        dy.value = pad.y + pad.height / 2 - (y + h / 2);
        s0.value = Math.min(0.9, Math.max(0.35, pad.width / Math.max(1, w)));
      } else {
        dx.value = pad.x - x + (pad.width - w > 0 ? 0 : 0);
        dy.value = pad.y + pad.height - (y + h);
      }
      shown.value = 1;
      p.value = withSpring(1, LAUNCH);
    });
  };

  const launched = useAnimatedStyle(() => {
    const k = p.value;
    if (reduce) return { opacity: k };
    return {
      opacity: shown.value,
      transform: [{ translateX: dx.value * (1 - k) }, { translateY: dy.value * (1 - k) }, { scale: s0.value + (1 - s0.value) * k }],
    };
  });

  return { ref, onLayout, style: pad ? launched : fallback };
}

// ---------------------------------------------------------------------------
// Chat bubbles
// ---------------------------------------------------------------------------

/** The learner's words: cobalt, raised on deep cobalt, tail at bottom right. */
/** `accessory` draws inside the bubble after the text (a sheen, a marker on its corner). */
export function LearnerBubble({ text, compact, style, accessory }: { text: string; compact?: boolean; style?: StyleProp<ViewStyle>; accessory?: ReactNode }) {
  return (
    <View style={[styles.learnerWrap, style]}>
      <Bubble side="learner" compact={compact}>
        <Text variant="body" color={color.white} style={compact ? styles.compactText : undefined} selectable>
          {text}
        </Text>
        {accessory}
      </Bubble>
    </View>
  );
}

/** The employee's words: white, raised, with the persona avatar. Children replace the text (typing dots). */
export function EmployeeBubble({
  text,
  avatar,
  name,
  compact,
  showAvatar = true,
  children,
  style,
}: {
  text?: string;
  avatar: AvatarIdentity;
  name?: string;
  compact?: boolean;
  showAvatar?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.employeeRow, style]}>
      {showAvatar ? <Avatar {...avatar} size={compact ? 26 : 34} accessibilityLabel={name} /> : null}
      <Bubble side="other" compact={compact}>
        {children ?? (
          <Text variant="body" style={compact ? styles.compactText : undefined} selectable>
            {text}
          </Text>
        )}
      </Bubble>
    </View>
  );
}

/**
 * The employee's bubble while they're replying. One element from the typing
 * dots to the finished line: its frame springs (layout transition) as the dots
 * give way to words and as each word arrives, so it grows instead of jumping;
 * text is clipped to the growing frame, so a new line is revealed, not dropped in.
 */
export function LiveEmployeeBubble({ text, typing, avatar, name }: { text: string; typing: boolean; avatar: AvatarIdentity; name?: string }) {
  const layout = useListLayout();
  const fades = useFades(200, 90);
  return (
    <View style={styles.employeeRow}>
      <Avatar {...avatar} size={34} accessibilityLabel={name} />
      <Bubble side="other" layout={layout} style={styles.live}>
        {typing ? (
          <Animated.View key="dots" exiting={fades.exiting}>
            <TypingDots />
          </Animated.View>
        ) : (
          <Animated.View key="text" entering={fades.entering}>
            <Text variant="body" selectable>
              {text}
            </Text>
          </Animated.View>
        )}
      </Bubble>
    </View>
  );
}

/** Three dots that rise in turn: someone is about to speak. */
export function TypingDots({ tint = color.faint }: { tint?: string }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel="Typing">
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} tint={tint} />
      ))}
    </View>
  );
}

function Dot({ i, tint }: { i: number; tint: string }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    const up = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
    const down = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    v.value = withDelay(i * 140, withRepeat(withSequence(up, down, withTiming(0, { duration: 360 })), -1));
    return () => cancelAnimation(v);
  }, [i, v]);
  const style = useAnimatedStyle(() =>
    reduce ? { opacity: 0.45 + 0.55 * v.value } : { opacity: 0.55 + 0.45 * v.value, transform: [{ translateY: -4 * v.value }] },
  );
  return <Animated.View style={[styles.dot, { backgroundColor: tint }, style]} />;
}

// ---------------------------------------------------------------------------
// Drill speech card: the line the learner responds to, entering with presence.
// ---------------------------------------------------------------------------

export function SpeechCard({
  speaker,
  avatar: identity,
  line,
  context,
}: {
  speaker: string;
  avatar: AvatarIdentity;
  line: string;
  context?: string;
}) {
  const reduce = useReduceMotion();
  // arriving from Home's START: the button itself becomes this bubble, so it doesn't rise in
  const heroed = !!useSession()?.hasPiece('cta');
  const avatar = useSharedValue(0);
  const bubble = useSharedValue(heroed ? 1 : 0);
  useEffect(() => {
    if (heroed) {
      avatar.value = withDelay(260, withSpring(1, spring.bouncy));
      return;
    }
    if (reduce) {
      avatar.value = withTiming(1, { duration: FADE_MS });
      bubble.value = withDelay(80, withTiming(1, { duration: FADE_MS }));
      return;
    }
    avatar.value = withDelay(60, withSpring(1, spring.bouncy));
    bubble.value = withDelay(220, withSpring(1, { damping: 14, stiffness: 190, mass: 0.9 }));
  }, [reduce, heroed, avatar, bubble]);

  const avatarStyle = useAnimatedStyle(() => (reduce ? { opacity: avatar.value } : { opacity: Math.min(1, avatar.value * 2), transform: [{ scale: 0.6 + 0.4 * avatar.value }] }));
  const bubbleStyle = useAnimatedStyle(() =>
    reduce
      ? { opacity: bubble.value }
      : { opacity: Math.min(1, bubble.value * 1.8), transform: [{ translateY: (1 - bubble.value) * 22 }, { scale: 0.9 + 0.1 * bubble.value }] },
  );

  return (
    <View accessible accessibilityLabel={`${speaker} says: ${line}`}>
      {context ? (
        <Text variant="caption" color={color.muted} style={styles.context}>
          {context}
        </Text>
      ) : null}
      <Animated.View style={[styles.speakerRow, avatarStyle]}>
        <Avatar {...identity} size={44} />
        <Text variant="label" color={color.ink}>
          {speaker}
        </Text>
      </Animated.View>
      <Animated.View style={[{ transformOrigin: '12% 0%' }, bubbleStyle]}>
        <HeroTarget name="cta" insetTop={8} style={styles.speechWrap}>
          <View style={styles.speechTail} />
          <Bubble side="other" tail={false} style={styles.speech}>
            <Text variant="subheading" style={[styles.speechText, line.length > 120 && styles.speechLong]} maxScale={1.5}>
              “{line}”
            </Text>
          </Bubble>
        </HeroTarget>
      </Animated.View>
    </View>
  );
}

/** What to try. Long instructions wrap; the target glyph anchors it as "the task". */
export function InstructionChip({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Callout
      dense
      align="center"
      glyph={
        <View style={styles.instructionIcon}>
          <TargetIcon size={16} weight="bold" color={color.white} />
        </View>
      }
      style={style}
      accessibilityRole="text"
      accessibilityLabel={`Task: ${text}`}
    >
      <Text variant="bodySmallStrong" color={color.primaryShadow}>
        {text}
      </Text>
    </Callout>
  );
}

// ---------------------------------------------------------------------------
// Coach voice: the antelope beside a speech bubble.
// ---------------------------------------------------------------------------

export const CoachSays = forwardRef<
  MascotHandle,
  {
    children: ReactNode;
    pose?: MascotPose;
    mood?: MascotMood;
    size?: number;
    paused?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function CoachSays({ children, pose = 'head', mood = 'idle', size = 64, paused, style }, ref) {
  return (
    <View style={[styles.coach, style]}>
      <Mascot ref={ref} pose={pose} mood={mood} size={size} paused={paused} accessibilityLabel="The antelope coach" />
      <Bubble side="coach" style={styles.coachBubble}>
        {typeof children === 'string' ? <Text variant="body">{children}</Text> : children}
      </Bubble>
    </View>
  );
});

// ---------------------------------------------------------------------------
// "One possible MI-consistent response" — never "the correct answer".
// ---------------------------------------------------------------------------

export function PossibleResponse({ text, index, style }: { text: string; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Callout
      overline={index !== undefined && index > 0 ? 'Another MI-consistent option' : 'One possible MI-consistent response'}
      overlineIcon={<QuotesIcon size={16} weight="fill" color={color.primary} />}
      style={style}
    >
      <Text variant="body" selectable>
        {text}
      </Text>
    </Callout>
  );
}

const styles = StyleSheet.create({
  learnerWrap: { alignItems: 'flex-end' },
  employeeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  live: { overflow: 'hidden' },
  compactText: { fontSize: 14, lineHeight: 19 },
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 7, paddingHorizontal: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  context: { marginBottom: space[3] },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  speechWrap: { paddingTop: 8 },
  speechTail: {
    position: 'absolute',
    top: 1,
    left: 16,
    width: 18,
    height: 18,
    backgroundColor: color.white,
    borderLeftWidth: border,
    borderTopWidth: border,
    borderColor: color.line,
    transform: [{ rotate: '45deg' }],
    borderTopLeftRadius: 4,
    zIndex: 2,
  },
  // a card-sized bubble: full width, roomier padding, no corner tail
  speech: { maxWidth: '100%', flexShrink: 0, paddingHorizontal: space[5], paddingVertical: space[5] },
  speechText: { fontSize: 20, lineHeight: 27 },
  speechLong: { fontSize: 17, lineHeight: 24 },
  instructionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  coach: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  coachBubble: { marginBottom: 6 },
});
