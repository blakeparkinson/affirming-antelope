// Dev-only: make this week's practice last week's, so Home's first look plays the weekly recap.
//   antelope://dev/recap
// Moves the practice log, the kept sessions, the streak and the week back 7 days and clears
// the recap's seen mark, then opens Home. Guests only (a signed-in account would sync it): signed in, it just opens Home.
import { addDays } from '@antelope/core';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';

const back = (iso: string) => new Date(Date.parse(iso) - 7 * 86_400_000).toISOString();

export default function DevRecap() {
  useEffect(() => {
    if (!__DEV__) return;
    if (useAccount.getState().status !== 'signed-in') {
      useLearner.setState((s) => ({
        practiceLog: s.practiceLog.map((r) => ({ ...r, at: back(r.at) })),
        sessions: s.sessions.map((x) => ({ ...x, startedAt: back(x.startedAt), endedAt: back(x.endedAt) })),
        streak: { ...s.streak, lastPracticeDay: s.streak.lastPracticeDay && addDays(s.streak.lastPracticeDay, -7) },
        weekStart: s.weekStart && addDays(s.weekStart, -7),
        recapSeenWeek: null,
        dailyRep: null,
      }));
    }
    setTimeout(() => router.replace('/'), 50);
  }, []);
  return __DEV__ ? <View /> : null;
}
