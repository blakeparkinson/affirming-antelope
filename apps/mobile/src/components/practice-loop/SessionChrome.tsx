import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, LayoutAnimation, Platform, StyleSheet, View, type KeyboardEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, XIcon, color, layout, space } from '@/design';
import { useReduceMotion } from '@/motion';
import { DismissZone } from './SessionSurface';
import { KEYBOARD_EASING, KEYBOARD_MS, useWebViewport } from './webKeyboard';

/**
 * Shared chrome for the practice-loop screens (lesson, drill, role-play):
 * a close X at top left, an optional centre and trailing slot, and a docked
 * bottom bar for the one primary action. Inside a SessionSurface the header
 * is also the drag handle: pull it down to dismiss.
 */
export function SessionHeader({
  onClose,
  closeLabel = 'Close',
  center,
  trailing,
  footer,
  style,
}: {
  onClose: () => void;
  closeLabel?: string;
  center?: ReactNode;
  trailing?: ReactNode;
  /** Along the header's bottom edge, e.g. the role-play's warmth thread. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <DismissZone>
      <View style={[styles.header, { paddingTop: insets.top + space[2] }, style]}>
        <View style={styles.headerRow}>
          <IconButton onPress={onClose} label={closeLabel} icon={<XIcon size={26} weight="bold" color={color.muted} />} />
          <View style={styles.center}>{center}</View>
          <View style={styles.trailing}>{trailing}</View>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </DismissZone>
  );
}

/** Bottom bar for the screen's primary action. Sits above the home indicator. */
export function Dock({ children, style, rule = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; rule?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, rule && styles.dockRule, { paddingBottom: Math.max(insets.bottom, space[3]) + space[2] }, style]}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

/**
 * Keyboard handling that works in Expo Go and on web: the screen's column
 * (scroll + dock) lifts with the keyboard on iOS and Android (edge-to-edge),
 * and on the web pads by the keyboard's overlap with the layout viewport
 * (see webKeyboard.ts: Safari would otherwise scroll the whole page).
 *
 * Not KeyboardAvoidingView: it measures itself relative to its parent, so a
 * column that sits below a header (the drill) was lifted short by the header's
 * height and the composer ended up under the keyboard's suggestion bar. This
 * measures the column in window coordinates when the keyboard moves and pads
 * by exactly the overlap, animated with the keyboard's own curve.
 */
export function KeyboardColumn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'web') return <WebKeyboardColumn style={style}>{children}</WebKeyboardColumn>;
  return <NativeKeyboardColumn style={style}>{children}</NativeKeyboardColumn>;
}

/**
 * Web: the session keeps the layout viewport's height while the keyboard is up
 * (white under the keyboard, no page scroll), and the column pads by the keyboard's
 * overlap. Safari reports the new viewport as the keyboard starts to move, so the
 * pad runs on a curve close to the keyboard's and the composer rides up with it.
 */
function WebKeyboardColumn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { keyboard } = useWebViewport();
  const reduce = useReduceMotion();
  const pad = useSharedValue(keyboard);
  useEffect(() => {
    pad.value = reduce ? keyboard : withTiming(keyboard, { duration: KEYBOARD_MS, easing: KEYBOARD_EASING });
  }, [keyboard, reduce, pad]);
  const lift = useAnimatedStyle(() => ({ paddingBottom: pad.value }));
  return <Animated.View style={[styles.fill, style, lift]}>{children}</Animated.View>;
}

function NativeKeyboardColumn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);
  useEffect(() => {
    const apply = (e: KeyboardEvent | null) => {
      const node = ref.current;
      if (!node) return;
      const animate = () => {
        if (Platform.OS === 'ios' && e?.duration) {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { duration: e.duration, type: LayoutAnimation.Types[e.easing] ?? LayoutAnimation.Types.keyboard },
          });
        }
      };
      if (!e) {
        animate();
        return setPad(0);
      }
      // the column's frame doesn't include the padding change, so its bottom is stable
      node.measureInWindow((_x, y, _w, h) => {
        const next = Math.max(0, Math.round(y + h - e.endCoordinates.screenY));
        setPad((prev) => {
          if (prev !== next) animate();
          return next;
        });
      });
    };
    const subs =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillChangeFrame', apply), Keyboard.addListener('keyboardWillHide', (e) => apply({ ...e, endCoordinates: { ...e.endCoordinates, screenY: 1e6 } }))]
        : [Keyboard.addListener('keyboardDidShow', apply), Keyboard.addListener('keyboardDidHide', () => apply(null))];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return (
    <View ref={ref} style={[styles.fill, style, { paddingBottom: pad }]}>
      {children}
    </View>
  );
}

export const sessionStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  scroll: { paddingHorizontal: layout.gutter },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: layout.gutter - 10, paddingBottom: space[2], backgroundColor: color.white, zIndex: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: space[2], width: '100%', maxWidth: layout.maxWidth + 20, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: 0 },
  trailing: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 10 },
  dock: { backgroundColor: color.white, paddingHorizontal: layout.gutter, paddingTop: space[3] },
  dockRule: { borderTopWidth: 2, borderTopColor: color.line },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
