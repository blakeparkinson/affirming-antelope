import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { createHapticGate } from '@/lib/hapticGate';
import { useLearner } from '@/state/store';

const enabled = () => Platform.OS !== 'web' && useLearner.getState().settings.haptics;
const safe = (p: Promise<void>) => p.catch(() => {});

// a light haptic right behind a heavy one is dropped (see hapticGate)
const gate = createHapticGate();
const heavy = (p: () => Promise<void>) => () => enabled() && gate.heavy(Date.now()) && safe(p());
const light = (p: () => Promise<void>) => () => enabled() && gate.light(Date.now()) && safe(p());

/**
 * Haptics paired with visual peaks. Call at the moment the motion lands
 * (press-in, snap, fill complete), never on a timer.
 */
export const haptic = {
  /** Selection change: tabs, segmented control, chips. */
  tick: light(() => Haptics.selectionAsync()),
  /** A raised control bottoming out. */
  press: light(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavier landing: sheet snap, card drop. */
  thud: heavy(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: heavy(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Locked or not-yet: gentle, not an error. */
  warn: heavy(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
