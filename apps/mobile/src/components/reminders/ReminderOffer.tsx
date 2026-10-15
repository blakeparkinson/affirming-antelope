import { DEFAULT_REMINDER_TIME, formatReminderTime, REMINDER_TIMES, shouldOfferReminders } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, Callout, ClockIcon, Raised, SegmentedControl, Text, TextLink, color, radius, space } from '@/design';
import { track } from '@/lib/analytics';
import { openNotificationSettings, remindersSupported, turnOnReminders } from '@/lib/reminders';
import { useLearner } from '@/state/store';

type Phase = 'ask' | 'busy' | 'on' | 'blocked' | 'gone';

const TIME_INDEX = Math.max(
  0,
  REMINDER_TIMES.findIndex((t) => t.hour === DEFAULT_REMINDER_TIME.hour && t.minute === DEFAULT_REMINDER_TIME.minute),
);

/** Whether to offer, decided once when the completion screen opens (the practice is already logged). */
function useOfferOnce(): boolean {
  const [offer] = useState(() => {
    if (!remindersSupported) return false;
    const s = useLearner.getState();
    return shouldOfferReminders({ asks: s.settings.reminderAsks ?? 0, practices: s.practiceLog.length, on: !!s.settings.reminders?.on });
  });
  return offer;
}

/**
 * The reminder offer on a completion screen: after the first finished practice, and once
 * more after the third if they said "Not now". Never the screen's primary action (that's
 * DONE); the system permission prompt only shows after "Remind me".
 */
/** `style` sits on the card itself, so a screen with no offer keeps no gap for it. */
export function ReminderOffer({ compact, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const offer = useOfferOnce();
  const [phase, setPhase] = useState<Phase>('ask');
  const [timeIndex, setTimeIndex] = useState(TIME_INDEX);
  const shown = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!offer || shown.current) return;
    shown.current = true;
    const s = useLearner.getState();
    track('reminder_prompt_shown', { ask: (s.settings.reminderAsks ?? 0) + 1 });
  }, [offer]);

  if (!offer || phase === 'gone') return null;

  const time = REMINDER_TIMES[timeIndex];
  const answered = () => {
    const s = useLearner.getState();
    s.setSetting('reminderAsks', (s.settings.reminderAsks ?? 0) + 1);
  };

  const remind = async () => {
    // a ref, not `phase`: a double tap lands before the re-render
    if (busy.current) return;
    busy.current = true;
    setPhase('busy');
    const permission = await turnOnReminders(time, 'offer').catch(() => 'denied' as const);
    // either way the question is settled: Me › Reminders is where it changes from here
    useLearner.getState().setSetting('reminderAsks', 2);
    setPhase(permission === 'granted' ? 'on' : 'blocked');
  };
  const notNow = () => {
    answered();
    track('reminder_declined', { source: 'offer', reason: 'not_now' });
    setPhase('gone');
  };

  if (phase === 'on' || phase === 'blocked') {
    return (
      <Callout style={style} dense glyph={<ClockIcon size={22} weight="bold" color={color.primary} />} align="center" accessibilityLiveRegion="polite">
        {phase === 'on' ? (
          <Text variant="bodySmall">
            Reminders on for {formatReminderTime(time.hour, time.minute)}. Change it any time in Me.
          </Text>
        ) : (
          <View style={styles.blocked}>
            <Text variant="bodySmall">Notifications are off for this app. Turn them on in Settings, then pick a time in Me.</Text>
            <TextLink label="Open Settings" onPress={openNotificationSettings} />
          </View>
        )}
      </Callout>
    );
  }

  return (
    <Raised style={style} contentStyle={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <ClockIcon size={22} weight="bold" color={color.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Want a nudge so this sticks?</Text>
          <Text variant="caption" color={color.muted}>
            One reminder a day. Skipped on days you’ve already practiced.
          </Text>
        </View>
      </View>
      <SegmentedControl
        accessibilityLabel="Reminder time"
        segments={REMINDER_TIMES.map((t, i) => ({ value: i, label: formatReminderTime(t.hour, t.minute) }))}
        value={timeIndex}
        onChange={setTimeIndex}
      />
      <View style={styles.actions}>
        <Button
          variant="secondary"
          size="md"
          label={phase === 'busy' ? 'Turning on…' : 'Remind me'}
          onPress={remind}
          disabled={phase === 'busy'}
          style={styles.flex}
          accessibilityHint={`A practice reminder every day at ${formatReminderTime(time.hour, time.minute)}`}
        />
        <TextLink label="Not now" onPress={notNow} />
      </View>
    </Raised>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[4], gap: space[3] },
  cardCompact: { padding: space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: { width: 40, height: 40, borderRadius: radius.badge, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  blocked: { gap: space[1], alignItems: 'flex-start' },
});
