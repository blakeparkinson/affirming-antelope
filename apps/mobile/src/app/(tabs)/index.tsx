import { addDays, dayAt, dayKey, getSkill, type DayKey } from '@antelope/core';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AssignmentCard } from '@/components/home/AssignmentCard';
import { PracticeTiles } from '@/components/home/PracticeTiles';
import { SEEN_DELAY, useSeen } from '@/components/home/motion';
import { ProgressList } from '@/components/home/ProgressList';
import { ThisWeek } from '@/components/home/ThisWeek';
import { DailyRepCard } from '@/components/home/DailyRepCard';
import { KeepSharpCard } from '@/components/home/KeepSharpCard';
import { FeedbackCard, GuestCohortPrompt, GuestJoinCard, JoinCohortCard, NothingAssigned } from '@/components/home/TrainerCards';
import { assignmentView, demoAssignmentView } from '@/data/assignments';
import { getPathway } from '@/data/pathways';
import { dailyRepShown, startDailyRep, useDailyRep } from '@/data/dailyRep';
import { keepSharpFor, skillFadedShown, startRefresh } from '@/data/keepSharp';
import { maybeShowRecap } from '@/data/recap';
import { firstNameOf, unseenReviews, useAccount } from '@/state/account';
import { syncNow } from '@/sync/engine';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { usePronkGate, usePullToPronk } from '@/components/home/usePullToPronk';
import { ChatsCircleIcon, Hoofprint, LightningIcon, Screen, ShuffleIcon, SparkleIcon, Text, border, color, layout, space } from '@/design';
import { openDrill, openRoleplay, pickDrill, pickScenario } from '@/data/routes';
import { Enter, FADE_MS, RollingNumber, useListLayout, useReduceMotion } from '@/motion';
import { useActivePathway, useCurrentUnit, useCurrentWeek, useFrozenThisWeek, useProgressRows, useStreakDays, useThisWeek, weekLabel } from '@/state/selectors';
import { useMoments } from '@/state/moments';
import { useLearner, type FreezeNotice } from '@/state/store';
import { useToday } from '@/state/useToday';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dateLine(day: DayKey) {
  return dayAt(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "A streak freeze covered yesterday, so your 12-day streak is safe. You have 1 left." */
function freezeNoteText({ days, streakDays, held }: FreezeNotice, day: DayKey) {
  const name = (d: string) => (d === addDays(day, -1) ? 'yesterday' : dayAt(d).toLocaleDateString(undefined, { weekday: 'long' }));
  const names = days.map(name);
  const which = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const covered = days.length === 1 ? `A streak freeze covered ${which}` : `Streak freezes covered ${which}`;
  const left = held === 0 ? 'Hit your weekly goal to earn another.' : `You have ${held} left.`;
  return `${covered}, so your ${streakDays}-day streak is safe. ${left}`;
}

export default function Home() {
  const focused = useIsFocused();
  const localName = useLearner((s) => s.firstName);
  const signedIn = useAccount((s) => s.status === 'signed-in');
  const profile = useAccount((s) => s.profile);
  const cohorts = useAccount((s) => s.cohorts);
  const assignments = useAccount((s) => s.assignments);
  const reviews = useAccount((s) => s.reviews);
  const submissions = useAccount((s) => s.submissions);
  const practiceLog = useLearner((s) => s.practiceLog);
  const demo = useLearner((s) => s.demo);
  // the account's name when signed in (not the email-derived default), the demo learner's, or none
  const firstName = signedIn ? (!profile?.needsName ? firstNameOf(profile?.displayName) : undefined) : demo ? localName : undefined;
  const hello = firstName ? `${greeting()}, ${firstName}` : greeting();
  const unseen = useMemo(() => unseenReviews(reviews), [reviews]);
  const [refreshing, setRefreshing] = useState(false);
  const streak = useStreakDays();
  const { weeklyGoal: goal, weekDays } = useThisWeek();
  const frozenDays = useFrozenThisWeek();
  const settleStreak = useLearner((s) => s.settleStreak);
  // Home stays mounted under the tabs: settle again when the day turns while it's open, or when the app comes back on a later day
  const day = useToday();
  // Freezes spend themselves when Home opens. A new one gets a note and its pip's ice reveal, for this visit only.
  const [freezeNote, setFreezeNote] = useState<string | null>(null);
  const [freezePips, setFreezePips] = useState<boolean[] | null>(null);
  // the clock spaced review reads (skill sharpness): set each time Home comes into view
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const used = settleStreak();
      if (used) {
        setFreezeNote(freezeNoteText(used, day));
        setFreezePips(used.pips);
      }
      // a milestone moment that didn't get its turn after the practice (closed early) plays here
      const t = setTimeout(() => useMoments.getState().release(), SEEN_DELAY + 300);
      // the first look of a new week: last week's recap, once (on any device)
      const recap = setTimeout(() => maybeShowRecap(day), SEEN_DELAY);
      return () => {
        clearTimeout(t);
        clearTimeout(recap);
        setFreezeNote(null);
        setFreezePips(null);
      };
    }, [settleStreak, day]),
  );
  const coach = useRef<MascotHandle>(null);
  const shiver = useCallback(() => coach.current?.shiver(), []);
  const pronk = usePronkGate(coach);
  const onCoachTap = usePronkTaps(pronk);
  const assignment = useLearner((s) => s.assignment);
  const skills = useLearner((s) => s.skills);
  const currentWeek = useCurrentWeek();
  const pathway = useActivePathway();
  const markGreeted = useLearner((s) => s.markGreeted);
  const liveRows = useProgressRows();
  const unit = useCurrentUnit();
  const reduce = useReduceMotion();
  const listLayout = useListLayout();
  const rep = useDailyRep();
  useEffect(() => {
    if (focused && rep) dailyRepShown(rep);
  }, [focused, rep]);

  // The coach waves on the first visit of the day only.
  const [greet] = useState(() => useLearner.getState().lastGreetedDay !== dayKey());
  useEffect(() => {
    if (greet) markGreeted();
  }, [greet, markGreeted]);

  const focusSkill = unit?.skills[0] ?? 'oars';

  // Home keeps updating under the practice screens. Hold what it shows until
  // it's back in view, so each change animates once, where it can be seen.
  // signed in: real assignments, with progress topped up by practice on this phone that hasn't synced yet
  const seen = useSeen(
    { streak, goal, weekDays, frozenDays, assignment, skills, rows: liveRows, currentWeek, pathwayId: pathway.id, assignments, cohorts, practiceLog, unseen, signedIn },
    focused,
  );
  // Keep it sharp: from the held skills, so it leaves (and the row refills) once Home is back in view
  const keepSharp = useMemo(() => keepSharpFor(seen.skills, now, getPathway(seen.pathwayId).setting), [seen.skills, seen.pathwayId, now]);
  useEffect(() => {
    if (focused && keepSharp) skillFadedShown(keepSharp);
  }, [focused, keepSharp]);
  const views = seen.signedIn
    ? seen.assignments.map((a) => assignmentView(a, seen.cohorts.find((c) => c.id === a.cohortId), seen.practiceLog, profile?.id))
    : seen.assignment
      ? [demoAssignmentView(seen.assignment)]
      : [];
  const newest = seen.unseen[0];

  // Header handoff: the big greeting leaves under a compact title bar.
  const scrollY = useSharedValue(0);
  // pull Home down and the antelope pronks (and a signed-in pull also syncs)
  const { crouch, released, onRefreshPronk } = usePullToPronk(scrollY, pronk, reduce);
  const onRefresh = useCallback(async () => {
    onRefreshPronk();
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }, [onRefreshPronk]);
  const greetH = useSharedValue(GREET_H);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      released(e.contentOffset.y);
    },
  });
  // the waving coach rests once it has scrolled away
  const [coachAway, setCoachAway] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > greetH.value + 140,
    (away, was) => {
      if (away !== was) scheduleOnRN(setCoachAway, away);
    },
  );
  const greetStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const y = scrollY.value;
    const h = greetH.value;
    return {
      opacity: interpolate(y, [0, h * 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [
        // parallax: it drifts up a little slower than the page
        { translateY: interpolate(y, [0, h * 1.2], [0, h * 0.3], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, h * 0.75], [1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Screen
      scrollHandler={onScroll}
      refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}
      overlay={<CompactBar title={hello} streak={seen.streak} scrollY={scrollY} greetH={greetH} reduce={reduce} />}
    >
      <Enter style={styles.header}>
        <Animated.View
          style={[styles.greeting, greetStyle]}
          onLayout={(e) => {
            greetH.value = Math.max(60, e.nativeEvent.layout.height);
          }}
        >
          <Text variant="caption" color={color.muted}>
            {dateLine(day)}
          </Text>
          <Text variant="title" accessibilityRole="header" style={styles.hello}>
            {firstName ? (
              <>
                {greeting()},{'\n'}
                {firstName}
              </>
            ) : (
              greeting()
            )}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.mascot, { transformOrigin: 'bottom' }, crouch]}>
          <Mascot ref={coach} pose="wave" size={124} greet={greet} paused={!focused || coachAway} accessibilityLabel="The antelope coach, waving" />
          {/* easter egg: three quick taps and it pronks. On top, not around: the Rive canvas would take the touch */}
          <Pressable onPressIn={onCoachTap} accessible={false} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Enter>

      <Enter index={1} style={styles.heroWrap}>
        {rep ? <DailyRepCard rep={rep} onStart={(id) => startDailyRep(rep, id, 'home')} /> : null}
      </Enter>

      {/* a trainer's feedback is the most personal thing on Home: right under the daily rep */}
      {newest ? (
        <Animated.View layout={listLayout}>
          <Enter index={2} from="scale" style={styles.feedback}>
            <FeedbackCard
              review={newest}
              sub={submissions.find((x) => x.id === newest.submissionId)}
              more={seen.unseen.length - 1}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: newest.submissionId } })}
            />
          </Enter>
        </Animated.View>
      ) : null}

      <Animated.View layout={listLayout}>
        <Enter index={2} style={styles.block}>
          <ThisWeek
            streak={seen.streak}
            goal={seen.goal}
            weekDays={seen.weekDays}
            frozenDays={seen.frozenDays}
            freezeNote={freezeNote}
            reveal={freezePips}
            onShiver={shiver}
          />
        </Enter>
      </Animated.View>

      {keepSharp ? (
        <Animated.View layout={listLayout}>
          <Enter index={2} style={styles.block}>
            <KeepSharpCard faded={keepSharp} onRefresh={() => startRefresh(keepSharp, rep)} />
          </Enter>
        </Animated.View>
      ) : null}

      <Animated.View layout={listLayout}>
        <Enter index={3}>
          <SectionHeader title="From your trainer" />
          {!seen.signedIn ? (
            views[0] ? (
              <>
                <AssignmentCard assignment={views[0]} />
                <GuestCohortPrompt onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'cohort' } })} />
              </>
            ) : (
              <GuestJoinCard onJoin={() => router.push({ pathname: '/sign-in', params: { reason: 'cohort' } })} />
            )
          ) : !seen.cohorts.length ? (
            <JoinCohortCard onJoin={() => router.push('/join')} />
          ) : views.length ? (
            <View style={styles.assignments}>
              {views.map((v) => (
                <AssignmentCard key={v.id} assignment={v} />
              ))}
            </View>
          ) : (
            <NothingAssigned trainerName={seen.cohorts[0].trainerName} />
          )}
        </Enter>
      </Animated.View>

      <Animated.View layout={listLayout}>
        <Enter index={4}>
          <SectionHeader
            title="Your progress"
            action={seen.currentWeek > getPathway(seen.pathwayId).units.length ? 'Pathway complete' : weekLabel(getPathway(seen.pathwayId), seen.currentWeek)}
            onAction={() => router.navigate('/path')}
          />
          <ProgressList rows={seen.rows} skills={seen.skills} now={now} />
        </Enter>
      </Animated.View>

      <Animated.View layout={listLayout}>
        <Enter index={5}>
          <SectionHeader title="More practice" action={`Focus this week: ${getSkill(focusSkill).name}`} />
          <PracticeTiles
            tiles={[
              {
                key: 'quick',
                title: 'Quick practice',
                detail: '5 min drill',
                icon: <LightningIcon size={24} weight="fill" color={color.primary} />,
                onPress: () => openDrill(pickDrill(focusSkill, skills[focusSkill].level), { minutes: 5, source: 'practice' }),
              },
              {
                key: 'roleplay',
                title: 'Role-play',
                detail: '10–15 min conversation',
                icon: <ChatsCircleIcon size={24} weight="fill" color={color.primary} />,
                onPress: () => openRoleplay(pickScenario(focusSkill).id, { minutes: 12, source: 'practice' }),
              },
              {
                key: 'challenge',
                title: 'Challenge me',
                detail: 'A random scenario',
                icon: <ShuffleIcon size={24} weight="bold" color={color.primary} />,
                onPress: () => router.navigate({ pathname: '/practice', params: { challenge: String(Date.now()) } }),
              },
              {
                key: 'bring',
                title: 'Bring me a challenge',
                detail: 'Practice a real conversation',
                icon: <SparkleIcon size={24} weight="fill" color={color.faint} />,
                soon: true,
              },
            ]}
          />
        </Enter>
      </Animated.View>
    </Screen>
  );
}

/** Taps this close together count toward the easter egg. */
const TAP_GAP_MS = 450;

/**
 * Three quick taps on Home's antelope and it pronks, with a thud on each landing. Taps
 * during a pronk don't queue another (the gate is shared with pull-to-pronk); the count
 * starts over after a pause.
 */
function usePronkTaps(pronk: () => boolean) {
  const taps = useRef<{ n: number; at: number }>({ n: 0, at: 0 });
  return useCallback(() => {
    const now = Date.now();
    const t = taps.current;
    t.n = now - t.at <= TAP_GAP_MS ? t.n + 1 : 1;
    t.at = now;
    if (t.n < 3) return;
    t.n = 0;
    pronk();
  }, [pronk]);
}

/** Fallback greeting height until it's measured (date + two title lines + padding). */
const GREET_H = 105;
const BAR_H = 44;

/**
 * Compact sticky title. It takes over as the big greeting passes under it:
 * the greeting is gone by 60% of its height, this fades and rises in over
 * 35-70%, the white face over 20-60%, and the 2pt rule once it's fully docked.
 * Reduced motion: the bar cross-fades in at the halfway point, nothing travels.
 */
function CompactBar({
  title,
  streak,
  scrollY,
  greetH,
  reduce,
}: {
  title: string;
  streak: number;
  scrollY: SharedValue<number>;
  greetH: SharedValue<number>;
  reduce: boolean;
}) {
  const insets = useSafeAreaInsets();
  const docked = useSharedValue(0);
  useAnimatedReaction(
    () => scrollY.value > greetH.value * 0.5,
    (on, was) => {
      if (reduce && on !== was) docked.value = withTiming(on ? 1 : 0, { duration: FADE_MS });
    },
    [reduce],
  );
  const face = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    return { opacity: interpolate(scrollY.value, [h * 0.2, h * 0.6], [0, 1], Extrapolation.CLAMP) };
  });
  const rule = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    return { opacity: interpolate(scrollY.value, [h * 0.6, h * 0.95], [0, 1], Extrapolation.CLAMP) };
  });
  const content = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [h * 0.35, h * 0.7], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(y, [h * 0.35, h * 0.7], [8, 0], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.bar, { height: insets.top + BAR_H }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.barFace, face]} />
      <Animated.View style={[styles.barRule, rule]} />
      <Animated.View style={[styles.barRow, { marginTop: insets.top }, content]}>
        <Text variant="subheading" numberOfLines={1} style={styles.barTitle}>
          {title}
        </Text>
        <View style={styles.barStreak}>
          <Hoofprint size={18} tint={color.gold} rotate={-12} />
          <RollingNumber value={streak} from={streak} variant="subheading" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barFace: { backgroundColor: color.white },
  barRule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: border, backgroundColor: color.line },
  barRow: {
    height: BAR_H,
    width: '100%',
    maxWidth: layout.maxWidth + layout.gutter * 2,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  barTitle: { flex: 1 },
  barStreak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2, marginBottom: -8 },
  greeting: { flex: 1, paddingBottom: space[5], transformOrigin: 'left top' },
  hello: { marginTop: 4 },
  mascot: { marginRight: space[2] },
  heroWrap: { zIndex: 1 },
  feedback: { marginTop: space[5] },
  assignments: { gap: space[4] },
  block: { marginTop: space[5] },
});
