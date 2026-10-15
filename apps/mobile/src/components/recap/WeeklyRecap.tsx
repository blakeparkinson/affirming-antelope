import { addDays, dayAt, getScenario, getSkill, getSkillLevel, recapMotion, type WeeklyRecap as Recap } from '@antelope/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Mascot } from '@/components/mascot';
import { callName } from '@/components/practice-loop/names';
import { WarmthTimeline } from '@/components/roleplay/WarmthTimeline';
import { Button, IconButton, QuotesIcon, Text, TextLink, TrendUpIcon, XIcon, color, layout, radius, space } from '@/design';
import { FADE_MS, RollingNumber, spring, useReduceMotion } from '@/motion';
import { recapDismissed, recapFor, recapShown, startThisWeek } from '@/data/recap';
import { useMoments, type RecapMoment } from '@/state/moments';
import { useLearner } from '@/state/store';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/*
 * Storyboard (recapMotion in @antelope/core). t = 0 when the recap opens on Home.
 *
 *   t 0      white floods in (200ms); the stage rises 18pt on `gentle`
 *   t 350    days practiced rolls up from 0, then reps (+120), then minutes (+240)
 *   t 900    the best role-play's warmth thread draws start to end, a bead riding it
 *   rest     "Start this week" has been live since t 0
 *
 * Close (X, "Not now", back) at any point: a 160ms fade. "Start this week" opens the daily rep.
 * Reduced motion: it cross-fades in with everything in place; nothing rolls or draws.
 * An empty week skips the stats: a fresh start, never a tally of what didn't happen.
 */

export function RecapHost() {
  const recap = useMoments((s) => s.recap);
  const milestone = useMoments((s) => s.showing);
  const close = useMoments((s) => s.closeRecap);
  if (!recap || milestone) return null;
  return <WeeklyRecap key={recap.weekStart} moment={recap} onDone={close} />;
}

function weekRange(monday: string): string {
  const fmt = (d: string) => dayAt(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`;
}

function WeeklyRecap({ moment, onDone }: { moment: RecapMoment; onDone: () => void }) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  // read once: the recap is a snapshot of the week, it doesn't move while it's open
  const [r] = useState(() => recapFor(useLearner.getState(), moment.weekStart));
  const motion = recapMotion(reduce);
  const backdrop = useSharedValue(0);
  const stage = useSharedValue(0);
  const leaving = useRef(false);
  const [drawArc, setDrawArc] = useState(false);

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: reduce ? FADE_MS : 200 });
    stage.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, spring.gentle);
    recapShown(moment, r);
    AccessibilityInfo.announceForAccessibility(r.empty ? 'A fresh start. A new week begins.' : `Your week in review. ${r.daysPracticed} days practiced, ${r.reps} reps.`);
    const t = setTimeout(() => setDrawArc(true), motion.arcDelay);
    return () => clearTimeout(t);
    // once, on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = useCallback(
    (then?: () => void) => {
      if (leaving.current) return;
      leaving.current = true;
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onDone);
      };
      stage.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) });
      backdrop.value = withDelay(40, withTiming(0, { duration: 160 }, done));
      then?.();
    },
    [onDone, stage, backdrop],
  );
  const dismiss = useCallback(() => {
    if (leaving.current) return;
    recapDismissed(moment, r);
    leave();
  }, [leave, moment, r]);
  const start = useCallback(() => leave(() => startThisWeek(moment, r)), [leave, moment, r]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stage.value * 1.4),
    transform: [{ translateY: reduce ? 0 : (1 - stage.value) * 18 }],
  }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.root, { paddingTop: insets.top + space[2], paddingBottom: insets.bottom + space[4] }, stageStyle]} accessibilityViewIsModal>
        <View style={styles.close}>
          <IconButton label="Close" onPress={dismiss} icon={<XIcon size={24} weight="bold" color={color.muted} />} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.halo} />
            <Mascot pose={r.empty ? 'wave' : 'celebrate'} size={120} greet={r.empty && !reduce} accessibilityLabel="The antelope coach" />
          </View>
          <Text variant="overline" color={color.muted} align="center">
            {moment.preview ? 'This week so far' : `Last week · ${weekRange(r.weekStart)}`}
          </Text>
          <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
            {r.empty ? 'A fresh start' : 'Your week in review'}
          </Text>
          {r.empty ? <FreshStart r={r} /> : <Stats r={r} countUp={motion.countUp} delay={motion.countDelay} stagger={motion.stagger} />}
          {!r.empty && r.bestRoleplay ? <BestRoleplay best={r.bestRoleplay} play={drawArc} settled={!motion.drawArc} /> : null}
          <NextSkill r={r} />
        </ScrollView>
        <View style={styles.actions}>
          <Button label="Start this week" fullWidth onPress={start} />
          <TextLink label="Not now" onPress={dismiss} style={styles.notNow} />
        </View>
      </Animated.View>
    </Modal>
  );
}

function Stats({ r, countUp, delay, stagger }: { r: Recap; countUp: boolean; delay: number; stagger: number }) {
  const top = r.topSkill;
  return (
    <View style={styles.block}>
      <View style={styles.stats}>
        <Stat value={r.daysPracticed} suffix="/7" label={r.daysPracticed === 1 ? 'day practiced' : 'days practiced'} countUp={countUp} delay={delay} />
        <Stat value={r.reps} label={r.reps === 1 ? 'rep' : 'reps'} countUp={countUp} delay={delay + stagger} />
        {/* minutes come from this device's log: practice on another device has none here */}
        {r.minutes > 0 ? <Stat value={r.minutes} label="minutes" countUp={countUp} delay={delay + stagger * 2} /> : null}
      </View>
      <View style={styles.pips} accessible accessibilityLabel={`Practiced on ${r.days.map((on, i) => (on ? DAY_NAMES[i] : null)).filter(Boolean).join(', ')}`}>
        {r.days.map((on, i) => (
          <View key={i} style={styles.pipCol}>
            <View style={[styles.pip, on ? styles.pipOn : null]} />
            <Text variant="caption" color={on ? color.ink : color.faint}>
              {DAY_LETTERS[i]}
            </Text>
          </View>
        ))}
      </View>
      {top ? (
        <View style={styles.row} accessible>
          <View style={styles.rowIcon}>
            <TrendUpIcon size={22} weight="bold" color={color.goldInk} />
          </View>
          <View style={styles.rowText}>
            <Text variant="caption" color={color.muted}>
              Moved the most
            </Text>
            <Text variant="subheading">{getSkill(top.skill).name}</Text>
          </View>
          <Text variant="label" color={color.muted}>
            {top.reps} {top.reps === 1 ? 'rep' : 'reps'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Stat({ value, suffix, label, countUp, delay }: { value: number; suffix?: string; label: string; countUp: boolean; delay: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <View style={styles.statNumber}>
        <RollingNumber value={value} from={countUp ? 0 : value} delay={delay} variant="number" color={color.primary} />
        {suffix ? (
          <Text variant="subheading" color={color.muted}>
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color={color.muted} align="center">
        {label}
      </Text>
    </View>
  );
}

function BestRoleplay({ best, play, settled }: { best: NonNullable<Recap['bestRoleplay']>; play: boolean; settled: boolean }) {
  const scenario = getScenario(best.refId);
  const name = scenario?.persona.name ?? 'They';
  const first = callName(name);
  const turns = useMemo(() => {
    const s = useLearner.getState().sessions.find((x) => x.id === best.sessionId);
    return s?.transcript ?? [];
  }, [best.sessionId]);
  const annotations = useMemo(() => {
    const d = useLearner.getState().sessions.find((x) => x.id === best.sessionId)?.debrief;
    return d && 'annotations' in d ? d.annotations : undefined;
  }, [best.sessionId]);
  const headline =
    best.changeTalk > 0
      ? `${first} opened up ${best.changeTalk === 1 ? 'once' : `${best.changeTalk} times`}`
      : best.warmthRise > 0
        ? `${first} warmed up as you talked`
        : `You stayed with ${first}`;
  return (
    <View style={[styles.block, styles.card]}>
      <Text variant="overline" color={color.muted}>
        Best conversation
      </Text>
      <Text variant="subheading" style={styles.cardTitle}>
        {headline}
      </Text>
      {scenario ? (
        <Text variant="caption" color={color.muted} style={styles.cardSub}>
          {scenario.issue}
        </Text>
      ) : null}
      <WarmthTimeline turns={turns} annotations={annotations} start={scenario?.desiredTrajectory[0]} name={name} play={play} settled={settled} />
      {best.line ? (
        <View style={styles.quote} accessible accessibilityLabel={`What you said: ${best.line}`}>
          <QuotesIcon size={20} weight="fill" color={color.primaryTint} />
          <View style={styles.rowText}>
            <Text variant="caption" color={color.muted}>
              What you said right before
            </Text>
            <Text variant="body" numberOfLines={4}>
              {best.line}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FreshStart({ r }: { r: Recap }) {
  return (
    <Text variant="body" color={color.muted} align="center" style={styles.fresh}>
      {r.nextSkill ? 'New week, clean slate. Two minutes today is a great way in.' : 'New week, clean slate. Two minutes is all it takes.'}
    </Text>
  );
}

function NextSkill({ r }: { r: Recap }) {
  if (!r.nextSkill) return null;
  const skill = getSkill(r.nextSkill.skill);
  return (
    <View style={[styles.block, styles.row]} accessible>
      <View style={[styles.rowIcon, styles.rowIconSoft]}>
        <Text variant="label" color={color.primary}>
          {r.nextSkill.level}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text variant="caption" color={color.muted}>
          {r.empty ? 'A good place to start' : 'Work on next'}
        </Text>
        <Text variant="subheading">{skill.name}</Text>
        <Text variant="caption" color={color.muted}>
          Level {r.nextSkill.level} · {getSkillLevel(r.nextSkill.level).name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: color.white },
  root: { flex: 1, paddingHorizontal: layout.gutter },
  close: { alignItems: 'flex-end' },
  scroll: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingBottom: space[5] },
  hero: { alignItems: 'center', justifyContent: 'flex-end', height: 150, marginBottom: space[3] },
  halo: { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: 6, backgroundColor: color.soft },
  title: { marginTop: space[1] },
  fresh: { marginTop: space[3], maxWidth: 300, alignSelf: 'center' },
  block: { marginTop: space[5] },
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[3], borderRadius: radius.lg, backgroundColor: color.soft },
  statNumber: { flexDirection: 'row', alignItems: 'baseline' },
  pips: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[4], paddingHorizontal: space[2] },
  pipCol: { alignItems: 'center', gap: 4 },
  pip: { width: 22, height: 22, borderRadius: 11, backgroundColor: color.line },
  pipOn: { backgroundColor: color.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[4] },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.goldTint },
  rowIconSoft: { backgroundColor: color.soft },
  rowText: { flex: 1, gap: 2 },
  card: { padding: space[4], borderRadius: radius.lg, borderWidth: 2, borderColor: color.line },
  cardTitle: { marginTop: space[1] },
  cardSub: { marginBottom: space[3] },
  quote: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  actions: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: space[3], alignItems: 'center' },
  notNow: { paddingVertical: space[1] },
});
