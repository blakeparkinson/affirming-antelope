// Dev-only: a completion screen whose practice levelled a skill up.
//   antelope://dev/levelup                      oars, level 2 → 3
//   antelope://dev/levelup?skill=evoking&from=4  any skill, from any level 1..5
//   antelope://dev/levelup?milestone=7           a 7-day streak milestone first, then the level-up
//   antelope://dev/levelup?motion=reduce         sets Me › Settings motion first (motion=system puts it back)
// Queues the moments the way a real practice does (held until the ticks land), and, for a
// guest, writes the new level into the store so Me shows it (and its row glows once).
import { SKILLS, type SkillId, type SkillLevelNumber } from '@antelope/core';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CompletionMoment, type PracticeSnapshot } from '@/components/practice-loop/Completion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, color, layout, space } from '@/design';
import { useAccount } from '@/state/account';
import { useMoments } from '@/state/moments';
import { liveStreak, thisWeek, useLearner } from '@/state/store';

type Params = { skill?: string; from?: string; milestone?: string; motion?: string; n?: string };

export default function DevLevelUp() {
  const params = useLocalSearchParams<Params>();
  // opening the link again while this screen is up reuses it: a fresh completion per link (add &n=2 to repeat one)
  return <Run key={JSON.stringify(params)} params={params} />;
}

function Run({ params }: { params: Params }) {
  const [before] = useState<PracticeSnapshot>(() => {
    const s = useLearner.getState();
    const goal = thisWeek(s).weeklyGoal;
    return { streak: liveStreak(s), goalDone: goal.done, goalTarget: goal.target };
  });

  useEffect(() => {
    if (!__DEV__) return;
    const skill = (SKILLS.some((k) => k.id === params.skill) ? params.skill : 'oars') as SkillId;
    const from = Math.min(5, Math.max(1, Number(params.from) || 2)) as SkillLevelNumber;
    const to = (from + 1) as SkillLevelNumber;
    if (params.motion === 'reduce' || params.motion === 'system') useLearner.setState((s) => ({ settings: { ...s.settings, motion: params.motion as 'reduce' | 'system' } }));
    const m = useMoments.getState();
    const milestone = Number(params.milestone);
    if (milestone > 0) m.queue({ kind: 'milestone', milestone, from: Math.max(0, milestone - 1) });
    m.queue({ kind: 'level-up', skill, from, to, fromPercent: 72, toPercent: 8 });
    if (useAccount.getState().status !== 'signed-in') {
      useLearner.setState((s) => ({ skills: { ...s.skills, [skill]: { ...s.skills[skill], level: to, percent: 8, status: 'in-progress' } } }));
    }
  }, [params.skill, params.from, params.milestone, params.motion]);

  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;
  return (
    <View style={[styles.root, { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4] }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <CompletionMoment title="Drill done" subtitle="Dev: a practice that levelled a skill up." before={before}>
        <View style={styles.actions}>
          <Button label="Continue" fullWidth onPress={() => router.replace('/me')} />
        </View>
      </CompletionMoment>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white, paddingHorizontal: layout.gutter },
  actions: { paddingBottom: space[4] },
});
