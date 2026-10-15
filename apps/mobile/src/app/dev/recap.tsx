// Dev-only: make this week's practice last week's, so Home's first look plays the weekly recap.
//   antelope://dev/recap
//   antelope://dev/recap?streak=6&near=engaging   also a 6-day streak through yesterday and Engaging one practice
//                                                 from its next level, so today's rep hits a milestone AND a level-up
// Moves the practice log, the kept sessions, the streak and the week back 7 days and clears
// the recap's seen mark, then opens Home. Guests only (a signed-in account would sync it): signed in, it just opens Home.
import { SKILLS, addDays, dayKey, type SkillId } from '@antelope/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';

const back = (iso: string) => new Date(Date.parse(iso) - 7 * 86_400_000).toISOString();

export default function DevRecap() {
  const p = useLocalSearchParams<{ streak?: string; near?: string }>();
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
      const streak = Number(p.streak);
      // forget milestones above the seeded streak, so the next one can be crossed again
      if (streak > 0) useLearner.setState((s) => ({ streak: { days: streak, lastPracticeDay: addDays(dayKey(), -1) }, milestones: (s.milestones ?? []).filter((m) => m.days <= streak) }));
      const near = SKILLS.find((k) => k.id === p.near)?.id as SkillId | undefined;
      if (near) {
        useLearner.setState((s) => {
          const was = s.skills[near];
          const level = was && was.status !== 'locked' ? was.level : 1;
          return { skills: { ...s.skills, [near]: { ...was, level, percent: 97, status: 'in-progress' } } };
        });
      }
    }
    setTimeout(() => router.replace('/'), 50);
  }, [p.streak, p.near]);
  return __DEV__ ? <View /> : null;
}
