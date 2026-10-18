// Dev-only: the reminder offer's alarm clock on its own.
//   antelope://dev/clock             pick a time (the hands sweep), then Ring
//   antelope://dev/clock?ring=1      rings right away (screen recordings)
import { formatReminderTime, REMINDER_TIMES } from '@antelope/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AlarmClock } from '@/components/reminders/AlarmClock';
import { Button, SegmentedControl, color, space } from '@/design';

export default function DevClock() {
  const { ring } = useLocalSearchParams<{ ring?: string }>();
  const [i, setI] = useState(2);
  // a new key remounts the clock, so Ring can play again
  const [run, setRun] = useState(0);
  const [ringing, setRinging] = useState(false);
  useEffect(() => {
    if (!ring) return;
    const t = setTimeout(() => setRinging(true), 900);
    return () => clearTimeout(t);
  }, [ring]);

  if (!__DEV__) return null;
  const t = REMINDER_TIMES[i];
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Alarm clock' }} />
      <View style={styles.stage}>
        <AlarmClock key={run} hour={t.hour} minute={t.minute} ringing={ringing} size={180} />
      </View>
      <SegmentedControl
        accessibilityLabel="Reminder time"
        segments={REMINDER_TIMES.map((x, k) => ({ value: k, label: formatReminderTime(x.hour, x.minute) }))}
        value={i}
        onChange={setI}
      />
      <Button
        fullWidth
        label="Ring"
        onPress={() => {
          setRinging(false);
          setRun((n) => n + 1);
          setTimeout(() => setRinging(true), 50);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: space[6], padding: space[5], paddingTop: space[8], backgroundColor: color.white },
  stage: { alignItems: 'center', paddingVertical: space[4] },
});
