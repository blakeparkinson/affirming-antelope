import { DEFAULT_REMINDER_TIME, formatReminderTime, hasLastCall, REMINDER_TIMES, type ReminderPrefs } from '@antelope/core';
import { useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BottomSheet, Button, SegmentedControl, Switch, Text, TextLink, color, space } from '@/design';
import { openNotificationSettings, turnOnReminders, updateReminders, useNotifyPermission } from '@/lib/reminders';
import { useLearner } from '@/state/store';

/**
 * Me › Settings › Reminders: on/off and the time. Turning on asks for permission when it
 * still can; when notifications are blocked for the app, the row says so and links to
 * the system Settings instead of a switch that can't work.
 */
export function ReminderSettings({ rowStyle }: { rowStyle: StyleProp<ViewStyle> }) {
  const prefs = useLearner((s) => s.settings.reminders);
  const permission = useNotifyPermission();
  const [sheet, setSheet] = useState(false);
  const busy = useRef(false);
  const time = { hour: prefs?.hour ?? DEFAULT_REMINDER_TIME.hour, minute: prefs?.minute ?? DEFAULT_REMINDER_TIME.minute };
  const blocked = permission === 'denied';
  const on = !!prefs?.on && permission === 'granted';
  const label = formatReminderTime(time.hour, time.minute);
  const lastCall = hasLastCall(time.hour, time.minute);

  const toggle = async (next: boolean) => {
    if (busy.current) return;
    if (!next) return updateReminders({ ...time, on: false });
    busy.current = true;
    try {
      await turnOnReminders(time, 'me');
    } finally {
      busy.current = false;
    }
  };

  const pick = (i: number) => {
    const t = REMINDER_TIMES[i];
    const next: ReminderPrefs = { on: true, hour: t.hour, minute: t.minute };
    if (prefs?.hour !== t.hour || prefs?.minute !== t.minute) updateReminders(next);
  };

  return (
    <>
      <View style={rowStyle}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Reminders</Text>
          <Text variant="caption" color={color.muted}>
            {blocked
              ? 'Notifications are off for this app in Settings'
              : on
                ? `Every day at ${label}, unless you’ve practiced`
                : 'A daily nudge to practice'}
          </Text>
          {blocked ? (
            <TextLink label="Open Settings" onPress={openNotificationSettings} style={styles.link} />
          ) : on ? (
            <TextLink label="Change time" onPress={() => setSheet(true)} style={styles.link} />
          ) : null}
        </View>
        {blocked ? null : <Switch accessibilityLabel="Reminders" value={on} onChange={toggle} />}
      </View>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} accessibilityLabel="Reminder time">
        <Text variant="heading" accessibilityRole="header">
          When should we nudge you?
        </Text>
        <Text variant="body" color={color.muted} style={styles.lede}>
          One reminder a day, skipped once you’ve practiced.
          {lastCall ? ' If your streak is on the line, a last call comes at 8:30 pm too.' : ''}
        </Text>
        <SegmentedControl
          accessibilityLabel="Reminder time"
          segments={REMINDER_TIMES.map((t, i) => ({ value: i, label: formatReminderTime(t.hour, t.minute) }))}
          value={Math.max(0, REMINDER_TIMES.findIndex((t) => t.hour === time.hour && t.minute === time.minute))}
          onChange={pick}
        />
        <Button label="Done" fullWidth onPress={() => setSheet(false)} style={styles.done} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  link: { alignSelf: 'flex-start', marginTop: -space[2], marginBottom: -space[2] },
  lede: { marginTop: space[2], marginBottom: space[4] },
  done: { marginTop: space[5] },
});
