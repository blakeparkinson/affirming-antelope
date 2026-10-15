// Dev-only: light the Path for a time of day and/or replay its unlock (renders nothing in release builds).
//   antelope://dev/path?time=dusk&replay=1
//   antelope://dev/path?time=night&week=8&replay=1&motion=reduce
// time: dawn | day | dusk | night, or `clock` to follow the real time again. in=1500 changes the
// light that long after Path opens, so the cross-fade plays on screen.
// week: set the active track's current week first (earlier weeks done). replay=1 rewinds the
// seen week so Path plays the N-1 → N unlock. motion: reduce | system (Me > Settings > Motion).
import { DAY_PHASES, type DayPhase } from '@antelope/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { getPathway } from '@/data/pathways';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';
import { setDayPhaseOverride } from '@/state/useDayPhase';

export default function DevPath() {
  const p = useLocalSearchParams<{ time?: string; in?: string; week?: string; replay?: string; motion?: string }>();
  useEffect(() => {
    if (!__DEV__) return;
    const light = () => {
      if (p.time === 'clock') setDayPhaseOverride(null);
      else if ((DAY_PHASES as readonly string[]).includes(p.time ?? '')) setDayPhaseOverride(p.time as DayPhase);
    };
    const later = Number(p.in);
    if (later > 0) setTimeout(light, later);
    else light();
    const s = useLearner.getState();
    if (p.motion === 'reduce' || p.motion === 'system') s.setSetting('motion', p.motion);
    const id = s.activePathwayId;
    const week = Number(p.week);
    if (week >= 1) {
      const earlier = getPathway(id)
        .units.filter((u) => u.week < week)
        .flatMap((u) => u.activities.map((a) => a.id));
      useLearner.setState((st) => ({
        progress: { ...st.progress, [id]: { currentWeek: week, completedActivityIds: earlier, pathSeenWeek: week } },
      }));
    }
    useAccount.getState().set({ onboarded: true });
    if (p.replay === '1') useLearner.getState().replayPathUnlock();
    setTimeout(() => router.replace('/path'), 50);
  }, [p.time, p.in, p.week, p.replay, p.motion]);
  return __DEV__ ? <View /> : null;
}
