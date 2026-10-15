import { DEFAULT_REMINDER_TIME, formatReminderTime, REMINDER_TIMES, shouldOfferReminders } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, SegmentedControl, Text, TextLink, color, space } from '@/design';
import { track } from '@/lib/analytics';
import { openNotificationSettings, remindersSupported, turnOnReminders } from '@/lib/reminders';
import { useMoments } from '@/state/moments';
import { useLearner } from '@/state/store';

type Phase = 'ask' | 'busy' | 'on' | 'blocked';

const TIME_INDEX = Math.max(
  0,
  REMINDER_TIMES.findIndex((t) => t.hour === DEFAULT_REMINDER_TIME.hour && t.minute === DEFAULT_REMINDER_TIME.minute),
);

/** Counted from `ready` (the ticks have landed): long enough to read them before the sheet covers them. */
const OPEN_AFTER_MS = 1800;

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
 * The reminder offer on a completion screen: a sheet that rises once the celebration has
 * landed, after the first finished practice and once more after the third if they said
 * "Not now". The system permission prompt only shows after "Remind me". Leaving the
 * screen before it opens doesn't count as an answer, so the next completion offers again.
 */
export function ReminderOffer({ ready = true }: { ready?: boolean }) {
  const offer = useOfferOnce();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('ask');
  const [timeIndex, setTimeIndex] = useState(TIME_INDEX);
  const opened = useRef(false);
  const busy = useRef(false);
  // a streak milestone or level-up from this practice has the screen first; the sheet rises after it
  const moment = useMoments((s) => !!(s.pending.length || s.showing));

  useEffect(() => {
    if (!offer || !ready || moment || opened.current) return;
    const t = setTimeout(() => {
      opened.current = true;
      setOpen(true);
      track('reminder_prompt_shown', { ask: (useLearner.getState().settings.reminderAsks ?? 0) + 1 });
    }, OPEN_AFTER_MS);
    return () => clearTimeout(t);
  }, [offer, ready, moment]);

  if (!offer) return null;

  const time = REMINDER_TIMES[timeIndex];
  const label = formatReminderTime(time.hour, time.minute);

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

  // "Not now", a swipe down or a tap on the backdrop, while the question is still open
  const close = () => {
    if (phase === 'busy') return;
    if (phase === 'ask') {
      const s = useLearner.getState();
      s.setSetting('reminderAsks', (s.settings.reminderAsks ?? 0) + 1);
      track('reminder_declined', { source: 'offer', reason: 'not_now' });
    }
    setOpen(false);
  };

  return (
    <BottomSheet open={open} onClose={close} accessibilityLabel="Practice reminders">
      {phase === 'on' ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="heading" accessibilityRole="header">
            You’re set for {label}
          </Text>
          <Text variant="body" color={color.muted} style={styles.lede}>
            One nudge a day, skipped on days you’ve already practiced. Change the time or turn it off in Me.
          </Text>
          <Button label="Done" fullWidth onPress={close} />
        </View>
      ) : phase === 'blocked' ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="heading" accessibilityRole="header">
            Notifications are off
          </Text>
          <Text variant="body" color={color.muted} style={styles.lede}>
            Turn them on for this app in Settings, then pick a time in Me.
          </Text>
          <Button label="Open Settings" fullWidth onPress={openNotificationSettings} />
          <TextLink label="Not now" onPress={close} style={styles.link} />
        </View>
      ) : (
        <View>
          <Text variant="heading" accessibilityRole="header">
            Want a nudge so this sticks?
          </Text>
          <Text variant="body" color={color.muted} style={styles.lede}>
            One reminder a day at a time you pick. Skipped on days you’ve already practiced.
          </Text>
          <SegmentedControl
            accessibilityLabel="Reminder time"
            segments={REMINDER_TIMES.map((t, i) => ({ value: i, label: formatReminderTime(t.hour, t.minute) }))}
            value={timeIndex}
            onChange={setTimeIndex}
          />
          <Button
            label={phase === 'busy' ? 'One moment' : 'Remind me'}
            fullWidth
            onPress={remind}
            disabled={phase === 'busy'}
            style={styles.primary}
            accessibilityHint={`A practice reminder every day at ${label}`}
          />
          <TextLink label="Not now" onPress={close} style={styles.link} />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  lede: { marginTop: space[2], marginBottom: space[5] },
  primary: { marginTop: space[5] },
  link: { alignSelf: 'center', marginTop: space[2] },
});
