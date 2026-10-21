import type { Tabs } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/design/haptics';
import { HouseIcon, PathIcon, TargetIcon, UserIcon } from '@/design/icons';
import { Text } from '@/design/Text';
import { border, color, layout, radius } from '@/design/tokens';
import { FADE_MS } from '@/motion/constants';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

type Kind = 'home' | 'path' | 'practice' | 'me';

const META: Record<string, { label: string; Icon: typeof HouseIcon; kind: Kind }> = {
  index: { label: 'Home', Icon: HouseIcon, kind: 'home' },
  path: { label: 'Path', Icon: PathIcon, kind: 'path' },
  practice: { label: 'Practice', Icon: TargetIcon, kind: 'practice' },
  me: { label: 'Me', Icon: UserIcon, kind: 'me' },
};

const PILL_W = 60;
const PILL_H = 34;
const ICON = 26;
const HALF = ICON / 2;
/** Fill/colour cross-fade between the idle (bold, muted) and active (fill, cobalt) icon. */
const SWAP_MS = 160;

/** Quick authored leg into a pose (anticipation / impact); the way back is always a spring. */
const into = (to: number, ms = 110) => withTiming(to, { duration: ms, easing: Easing.out(Easing.cubic) });

/**
 * Custom tab bar. A periwinkle pill slides under the active icon on the snappy
 * spring (stretching while it travels). Each icon has its own select gesture:
 * the house squashes onto its foundation and springs up, the path walks its
 * curve, the target takes a hit and sends out one thin ring, the person nods.
 * Bold → fill and muted → cobalt cross-fade. One selection tick per change.
 * Reduced motion: no travel anywhere; the pill and icons cross-fade.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const count = state.routes.length;
  const tabW = w / count;
  const x = useSharedValue(0);
  const stretch = useSharedValue(1);
  const pillOn = useSharedValue(1);
  const placed = useRef(false);

  useEffect(() => {
    if (!tabW) return;
    const to = state.index * tabW + (tabW - PILL_W) / 2;
    if (!placed.current) {
      // first layout (or a width change before we've settled): place, don't travel
      placed.current = true;
      x.value = to;
      return;
    }
    if (reduce) {
      // fade out where it is, jump while invisible, fade in under the new tab
      cancelAnimation(stretch);
      stretch.value = 1;
      pillOn.value = withSequence(withTiming(0, { duration: 90 }), withTiming(1, { duration: FADE_MS }));
      x.value = withDelay(90, withTiming(to, { duration: 0 }));
      return;
    }
    pillOn.value = withTiming(1, { duration: 90 });
    x.value = withSpring(to, spring.snappy);
    stretch.value = withSequence(withSpring(1.35, spring.snappy), withSpring(1, spring.bouncy));
  }, [state.index, tabW, reduce, x, stretch, pillOn]);

  const pill = useAnimatedStyle(() => ({
    opacity: pillOn.value,
    transform: [{ translateX: x.value }, { scaleX: stretch.value }],
  }));

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: layout.tabBarHeight + insets.bottom }]}>
      {/* The bar's rule and white run edge to edge; the tabs keep to the content column, so on a wide screen they sit under it. */}
      <View
        style={styles.tabs}
        onLayout={(e) => {
          const next = e.nativeEvent.layout.width;
          if (next !== w) placed.current = false;
          setW(next);
        }}
        accessibilityRole="tablist"
      >
        {tabW > 0 && <Animated.View pointerEvents="none" style={[styles.pill, pill]} />}
        {state.routes.map((route, i) => {
          const meta = META[route.name] ?? { label: route.name, Icon: HouseIcon, kind: 'home' as const };
          const focused = state.index === i;
          return (
            <Tab
              key={route.key}
              label={meta.label}
              Icon={meta.Icon}
              kind={meta.kind}
              focused={focused}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  haptic.tick();
                  navigation.navigate(route.name, route.params);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

interface Channels {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  rot: SharedValue<number>;
  sx: SharedValue<number>;
  sy: SharedValue<number>;
  ripple: SharedValue<number>;
}

/** Each icon's select gesture. Every sequence starts from the current values, so a re-select mid-flight retargets instead of queueing. */
function play(kind: Kind, c: Channels) {
  switch (kind) {
    case 'home':
      // squash down onto the foundation, then spring up (the bouncy overshoot is the stretch)
      c.sy.value = withSequence(into(0.74, 100), withSpring(1, spring.bouncy));
      c.sx.value = withSequence(into(1.16, 100), withSpring(1, spring.bouncy));
      c.ty.value = withSpring(0, spring.snappy);
      return;
    case 'path':
      // two little steps along the S: lean left and hop, lean right and hop, settle
      c.rot.value = withSequence(into(-13, 90), into(10, 120), withSpring(0, spring.release));
      c.tx.value = withSequence(into(-2, 90), into(2.5, 120), withSpring(0, spring.release));
      c.ty.value = withSequence(into(-3, 90), into(0, 60), into(-2, 60), withSpring(0, spring.release));
      return;
    case 'practice':
      // a hit: knocked back small, punches forward past rest, settles; one thin ring goes out
      c.sx.value = withSequence(into(0.78, 80), withSpring(1, spring.bouncy));
      c.sy.value = withSequence(into(0.78, 80), withSpring(1, spring.bouncy));
      c.ripple.value = 0;
      c.ripple.value = withDelay(70, withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) }));
      return;
    case 'me':
      // a friendly nod: tip forward and dip, come back up with a small tilt, settle
      c.rot.value = withSequence(into(-9, 120), into(5, 140), withSpring(0, spring.release));
      c.ty.value = withSequence(into(2.5, 120), withSpring(0, spring.release));
      c.sy.value = withSequence(into(0.93, 120), withSpring(1, spring.release));
      return;
  }
}

function rest(c: Channels) {
  c.tx.value = withSpring(0, spring.snappy);
  c.ty.value = withSpring(0, spring.snappy);
  c.rot.value = withSpring(0, spring.snappy);
  c.sx.value = withSpring(1, spring.snappy);
  c.sy.value = withSpring(1, spring.snappy);
  cancelAnimation(c.ripple);
  c.ripple.value = 1;
}

function Tab({
  label,
  Icon,
  kind,
  focused,
  onPress,
}: {
  label: string;
  Icon: typeof HouseIcon;
  kind: Kind;
  focused: boolean;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const on = useSharedValue(focused ? 1 : 0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const ripple = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    const c = { tx, ty, rot, sx, sy, ripple };
    if (!mounted.current) {
      // the tab that's active at launch just is; no gesture on mount
      mounted.current = true;
      return;
    }
    on.value = withTiming(focused ? 1 : 0, { duration: reduce ? FADE_MS : SWAP_MS });
    if (focused && !reduce) play(kind, c);
    else rest(c);
  }, [focused, reduce, kind, on, tx, ty, rot, sx, sy, ripple]);

  // Pivot at the icon's foot: rotation and squash keep the bottom edge planted.
  const iconStyle = useAnimatedStyle(() => {
    const a = (rot.value * Math.PI) / 180;
    return {
      transform: [
        { translateX: tx.value + HALF * Math.sin(a) },
        { translateY: ty.value + HALF * (1 - Math.cos(a)) + HALF * (1 - sy.value) },
        { rotate: `${rot.value}deg` },
        { scaleX: sx.value },
        { scaleY: sy.value },
      ],
    };
  });
  const activeStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value >= 1 ? 0 : 0.85 * (1 - ripple.value),
    transform: [{ scale: 0.7 + 0.8 * ripple.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
    >
      <View style={styles.iconBox}>
        {kind === 'practice' ? <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} /> : null}
        <Animated.View style={[styles.icon, iconStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, idleStyle]}>
            <Icon size={ICON} weight="bold" color={color.muted} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
            <Icon size={ICON} weight="fill" color={color.primary} />
          </Animated.View>
        </Animated.View>
      </View>
      <View>
        <Animated.View style={idleStyle}>
          <Text variant="tabLabel" color={color.muted} style={styles.label} maxScale={1.15}>
            {label}
          </Text>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
          <Text variant="tabLabel" color={color.primary} style={styles.label} maxScale={1.15}>
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const RIPPLE = 30;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.white,
    borderTopWidth: border,
    borderTopColor: color.line,
  },
  tabs: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  pill: {
    position: 'absolute',
    top: 7,
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 11, minHeight: layout.minHit },
  iconBox: { width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' },
  icon: { width: ICON, height: ICON },
  ripple: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 1.5,
    borderColor: color.primary,
  },
  label: { marginTop: 5, textAlign: 'center' },
});
