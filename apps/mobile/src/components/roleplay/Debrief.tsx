import { getScenario, getSkill, type Debrief as DebriefData, type NextStep, type ScenarioSpec, type SelfReflection, type Turn } from '@antelope/core';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Mascot } from '@/components/mascot';
import { callName } from '@/components/practice-loop/names';
import { PracticeTicks, type PracticeSnapshot } from '@/components/practice-loop/Completion';
import { ReminderOffer } from '@/components/reminders/ReminderOffer';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  Avatar,
  BarbellIcon,
  Button,
  CaretRightIcon,
  CheckIcon,
  Chip,
  LightbulbIcon,
  PressableSurface,
  SealCheckIcon,
  ShuffleIcon,
  Text,
  TrendUpIcon,
  border,
  color,
  radius,
  space,
  personaAvatar,
} from '@/design';
import { Enter, useReduceMotion } from '@/motion';
import { Cascade } from './Cascade';
import { TypeIn } from './TypeIn';
import { KeyMoments } from './KeyMoments';
import { MovesPanel } from './MovesPanel';
import { ReplayChart, type Exchange } from './ReplayChart';
import { ReviewSheet, type ReviewGate } from './ReviewSheet';
import { router } from 'expo-router';
import { onFlowClosed } from '@/lib/flowEvents';
import { firstNameOf, personSeed, useAccount } from '@/state/account';
import type { PracticeSession } from '@/state/store';

export type NextChoice = NextStep | 'easier';

const FEELING: Record<SelfReflection['feeling'], string> = { rough: 'Rough', mixed: 'Mixed', solid: 'Solid' };

/** Debriefs that have already played their reveal: any later visit shows them settled. */
const played = new WeakSet<DebriefData>();

/*
 * The debrief reveal (first visit only; later visits are settled).
 *
 *   0ms      coach pops in (scale) beside an empty bubble
 *   60       the coach's answer to your read types in, line by line, caret riding the edge (≤1.4s)
 *   typed    the compact ticks land: hoofprint stamp + burst, streak rolls, ring advances (PracticeTicks)
 *   +700     each section below plays when it's on screen (≥ 80pt into the viewport), never before the coach
 *            has finished, so nothing competes with the words:
 *     chart     the line traces left to right; markers pop as it reaches them; key moments (ochre rings)
 *               land with a light haptic; it settles on the first key moment
 *     moves     tallies roll up on a 70ms stagger, then the balance beam tips (haptic tick at its first peak)
 *     strengths cascade in on an 80ms stagger, each seal popping as its line arrives
 * Reduced motion: everything is present at once (fades only), no haptic beats except the ticks' own.
 */

/**
 * The payoff. Coach responds to your own read first, then the replay chart,
 * your moves, strengths, key moments, one thing to try, and what next (never
 * a dead end). Trainer review is opt-in, for this session only.
 */
export function Debrief({
  scenario,
  turns,
  reflection,
  debrief,
  before,
  session,
  onNext,
  onClose,
}: {
  scenario: ScenarioSpec;
  turns: Turn[];
  reflection: SelfReflection;
  debrief: DebriefData;
  before: PracticeSnapshot;
  /** This conversation as saved on the device (what a trainer review shares). */
  session: PracticeSession | null;
  onNext: (c: NextChoice) => void;
  onClose: () => void;
}) {
  const focused = useIsFocused();
  const p = scenario.persona;
  const first = callName(p.name);
  const [review, setReview] = useState(false);
  // sign-in / join are full screens: the sheet steps aside and comes back when the learner
  // does, if the step actually happened (a cancelled sign-in just leaves them on the debrief)
  const [resume, setResume] = useState<ReviewGate | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(resumeTimer.current), []);
  useEffect(() => {
    if (!resume) return;
    return onFlowClosed(() => {
      const a = useAccount.getState();
      const done = resume === 'sign-in' ? a.status === 'signed-in' : a.cohorts.length > 0;
      // once the flow's sheet is down
      resumeTimer.current = setTimeout(() => {
        setResume(null);
        if (done) setReview(true);
      }, 450);
    });
  }, [resume]);
  const onGate = (g: ReviewGate) => {
    setReview(false);
    setResume(g);
    setTimeout(() => router.push(g === 'sign-in' ? { pathname: '/sign-in', params: { reason: 'review' } } : '/join'), 280);
  };
  const cohorts = useAccount((s) => s.cohorts);
  const shared = useAccount((s) => (session ? s.submissions.find((x) => x.sessionId === session.id && x.status !== 'withdrawn') : undefined));
  const reviewedBy = useAccount((s) => (shared ? s.reviews.find((r) => r.submissionId === shared.id)?.trainerName : undefined));
  // the cohort's trainer, else a neutral phrase (guests have no trainer to name yet)
  const cohortTrainer = (shared && cohorts.find((c) => c.id === shared.cohortId)?.trainerName) ?? cohorts[0]?.trainerName;
  const trainerName = cohortTrainer ?? 'your trainer';
  const trainerFirst = firstNameOf(cohortTrainer) ?? 'Your trainer';
  // a few celebratory hops when it's earned, then the antelope settles
  const [cheer, setCheer] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCheer(false), 3400);
    return () => clearTimeout(t);
  }, []);
  const scroll = useRef<ScrollView>(null);
  const reduce = useReduceMotion();
  const [settled] = useState(() => played.has(debrief));
  useEffect(() => {
    played.add(debrief);
  }, [debrief]);
  const [typed, setTyped] = useState(settled);
  const onTyped = useCallback(() => setTyped(true), []);
  // the compact ticks get their moment (stamp, roll, ring) before the chart starts drawing beside them
  const [ticked, setTicked] = useState(settled);
  useEffect(() => {
    if (!typed || ticked) return;
    const id = setTimeout(() => setTicked(true), reduce ? 0 : 700);
    return () => clearTimeout(id);
  }, [typed, ticked, reduce]);

  // sections play when they scroll into view (after the coach has finished speaking)
  const view = useRef({ y: 0, h: 0 });
  const tops = useRef<Record<string, number>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const check = useCallback(() => {
    const { y, h } = view.current;
    if (!h) return;
    setSeen((prev) => {
      let next = prev;
      for (const [k, top] of Object.entries(tops.current)) {
        if (!prev[k] && top < y + h - 80) next = next === prev ? { ...prev, [k]: true } : { ...next, [k]: true };
      }
      return next;
    });
  }, []);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    view.current.y = e.nativeEvent.contentOffset.y;
    check();
  };
  const track = (key: string) => (e: LayoutChangeEvent) => {
    tops.current[key] = e.nativeEvent.layout.y;
    check();
  };
  const plays = (key: string) => settled || reduce || (ticked && !!seen[key]);

  const exchanges = useMemo(() => buildExchanges(turns, debrief), [turns, debrief]);
  const traj = exchanges.map((e) => e.value);
  const net = traj.length > 1 ? traj[traj.length - 1] - traj[0] : 0;
  const celebrate = net >= 1 || (traj[traj.length - 1] ?? 0) >= 1;

  const harder = scenario.harderId ? getScenario(scenario.harderId) : undefined;
  const easier = scenario.easierId ? getScenario(scenario.easierId) : undefined;
  const suggested: NextChoice = debrief.suggestedNextStep === 'harder' && !harder ? 'new-scenario' : debrief.suggestedNextStep;
  const skill = getSkill(scenario.primaryChallenge);

  const options: { key: NextChoice; title: string; detail: string; icon: ReactNode; short: string }[] = [
    { key: 'try-again', title: 'Try again', detail: `Same scenario, a fresh conversation with ${first}.`, icon: <ArrowCounterClockwiseIcon size={22} weight="bold" color={color.primary} />, short: 'Try again' },
    { key: 'same-skill', title: 'Practice this skill', detail: `A short drill on ${skill.name.toLowerCase()}.`, icon: <BarbellIcon size={22} weight="bold" color={color.primary} />, short: 'Practice skill' },
    ...(harder
      ? [{ key: 'harder' as const, title: 'Try a harder scenario', detail: `${harder.persona.name}: “${harder.title}”`, icon: <TrendUpIcon size={22} weight="bold" color={color.primary} />, short: 'Try harder' }]
      : []),
    ...(easier
      ? [{ key: 'easier' as const, title: 'Try an easier one', detail: `${easier.persona.name}: “${easier.title}”`, icon: <TrendUpIcon size={22} weight="bold" color={color.primary} style={{ transform: [{ scaleY: -1 }] }} />, short: 'Try easier' }]
      : []),
    { key: 'new-scenario', title: 'New scenario', detail: 'Someone new, a different conversation.', icon: <ShuffleIcon size={22} weight="bold" color={color.primary} />, short: 'New scenario' },
  ];
  const pick = options.find((o) => o.key === suggested) ?? options[0];

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={onClose}
        center={
          <View style={styles.headCenter}>
            <Text variant="subheading">Debrief</Text>
            <Text variant="caption" color={color.muted} numberOfLines={1}>
              {scenario.title}
            </Text>
          </View>
        }
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[sessionStyles.scroll, styles.content]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onLayout={(e) => {
          view.current.h = e.nativeEvent.layout.height;
          check();
        }}
      >
        <View style={sessionStyles.column}>
          {/* coach answers your own read first */}
          <Enter from="scale" style={styles.coach}>
            <Mascot
              pose={celebrate ? 'celebrate' : 'head'}
              mood={celebrate && cheer ? 'cheer' : 'idle'}
              size={celebrate ? 112 : 84}
              paused={!focused}
              accessibilityLabel={celebrate ? 'The antelope coach, celebrating' : 'The antelope coach'}
            />
            <View style={styles.coachBubble}>
              <Text variant="overline" color={color.primaryShadow}>
                You called it {FEELING[reflection.feeling].toLowerCase()}
              </Text>
              <TypeIn text={debrief.reflectionResponse} settled={settled} onDone={onTyped} style={styles.coachText} />
            </View>
          </Enter>

          <Enter index={1} style={styles.ticks}>
            <PracticeTicks before={before} compact delay={settled ? 0 : 150} start={typed} />
          </Enter>
          <ReminderOffer ready={typed} />

          <Section index={2} title="How the conversation moved" onLayout={track('chart')}>
            <ReplayChart exchanges={exchanges} name={p.name} avatar={personaAvatar(p, scenario.setting)} play={plays('chart')} settled={settled} />
          </Section>

          <Section index={3} title="Your moves" onLayout={track('moves')}>
            <MovesPanel tallies={debrief.tallies} name={p.name} play={plays('moves')} settled={settled} />
          </Section>

          {debrief.strengths.length ? (
            <Section index={4} title="What went well" onLayout={track('strengths')}>
              <View style={styles.strengths}>
                {debrief.strengths.map((s, i) => (
                  <Cascade key={i} index={i} play={plays('strengths')} settled={settled} style={styles.strength} icon={<SealCheckIcon size={22} weight="fill" color={color.gold} />}>
                    <Text variant="body" style={styles.flex}>
                      {s}
                    </Text>
                  </Cascade>
                ))}
              </View>
            </Section>
          ) : null}

          {debrief.keyMoments.length ? (
            <Section index={5} title="Key moments" caption={debrief.keyMoments.length > 1 ? 'Swipe for more' : undefined}>
              <KeyMoments moments={debrief.keyMoments} turns={turns} />
            </Section>
          ) : null}

          <Section index={6} title="Try next">
            <View style={styles.tryNext}>
              <View style={styles.tryIcon}>
                <LightbulbIcon size={22} weight="fill" color={color.white} />
              </View>
              <Text variant="bodyStrong" style={styles.flex}>
                {debrief.tryNext}
              </Text>
            </View>
          </Section>

          <Section index={7} title="What next">
            <View style={styles.options}>
              {options.map((o) => {
                const isPick = o.key === pick.key;
                return (
                  <PressableSurface
                    key={o.key}
                    onPress={() => onNext(o.key)}
                    tone={isPick ? 'soft' : 'surface'}
                    edge={isPick ? color.primary : undefined}
                    shadow={isPick ? color.primary : undefined}
                    depth={4}
                    radius={radius.surface}
                    accessibilityLabel={`${o.title}. ${o.detail}${isPick ? ". Coach's pick" : ''}`}
                    contentStyle={styles.option}
                  >
                    <View style={[styles.optionIcon, isPick && styles.optionIconPick]}>{o.icon}</View>
                    <View style={styles.flex}>
                      <View style={styles.optionTitle}>
                        <Text variant="subheading" color={isPick ? color.primaryShadow : color.ink}>
                          {o.title}
                        </Text>
                        {isPick ? <Chip label="Coach’s pick" tone="primary" /> : null}
                      </View>
                      <Text variant="caption" color={color.muted} numberOfLines={2}>
                        {o.detail}
                      </Text>
                    </View>
                    <CaretRightIcon size={18} weight="bold" color={color.faint} />
                  </PressableSurface>
                );
              })}
            </View>
          </Section>

          <Enter index={8} style={styles.reviewWrap}>
            <PressableSurface
              onPress={() => setReview(true)}
              tone="surface"
              depth={4}
              radius={radius.surface}
              accessibilityLabel={shared ? reviewRowTitle(shared.status, trainerName, reviewedBy) : `Submit for trainer review. Share only this session with ${trainerName}`}
              contentStyle={styles.review}
            >
              <Avatar seed={personSeed(cohortTrainer ?? 'trainer')} size={44} />
              <View style={styles.flex}>
                <Text variant="subheading">{shared ? reviewRowTitle(shared.status, trainerName, reviewedBy) : 'Submit for trainer review'}</Text>
                <Text variant="caption" color={color.muted}>
                  {shared
                    ? reviewedBy
                      ? 'Their feedback is waiting on Home.'
                      : shared.local
                        ? 'Saved. It sends as soon as you’re online.'
                        : `${trainerFirst} will review it before group.`
                    : `Share only this session with ${trainerName}.`}
                </Text>
              </View>
              {shared ? (
                <View style={styles.sentTick}>
                  <CheckIcon size={14} weight="bold" color={color.navy} />
                </View>
              ) : (
                <CaretRightIcon size={18} weight="bold" color={color.faint} />
              )}
            </PressableSurface>
          </Enter>

          <Text variant="caption" color={color.muted} align="center" style={styles.footnote}>
            Feedback is AI-generated, one possible read of the conversation. You and your trainer are the judges.
          </Text>
        </View>
      </ScrollView>
      <Dock>
        <Button label={pick.short} fullWidth onPress={() => onNext(pick.key)} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
      </Dock>

      <ReviewSheet
        open={review}
        onClose={() => setReview(false)}
        session={session}
        onGate={onGate}
        turnCount={turns.length}
        feeling={FEELING[reflection.feeling]}
      />
    </View>
  );
}

function Section({
  index,
  title,
  caption,
  children,
  onLayout,
}: {
  index: number;
  title: string;
  caption?: string;
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Enter index={index} style={styles.section} onLayout={onLayout}>
      <View style={styles.sectionHead}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {caption ? (
          <Text variant="caption" color={color.muted}>
            {caption}
          </Text>
        ) : null}
      </View>
      {children}
    </Enter>
  );
}

/** Pair each employee turn with the learner turn that prompted it, plus the observer's notes. */
export function buildExchanges(turns: Turn[], d: DebriefData): Exchange[] {
  const ann = new Map(d.annotations.map((a) => [a.turnId, a]));
  const keys = new Set(d.keyMoments.map((k) => k.turnId));
  const employee = turns.filter((t) => t.speaker === 'employee');
  return employee.map((e, i) => {
    const at = turns.indexOf(e);
    const prev = turns[at - 1];
    const learner = prev?.speaker === 'learner' ? prev : undefined;
    const ea = ann.get(e.id);
    const la = learner ? ann.get(learner.id) : undefined;
    const raw = d.trajectory[i] ?? ea?.intensity ?? 0;
    return {
      index: i,
      value: Number.isFinite(raw) ? raw : 0,
      employee: e,
      employeeNote: ea?.note,
      stance: ea?.stance,
      learner,
      move: la?.move,
      learnerNote: la?.note,
      keyMoment: !!learner && keys.has(learner.id),
    };
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headCenter: { alignItems: 'center', maxWidth: 240 },
  content: { paddingTop: space[2], paddingBottom: space[8] },
  coach: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  coachBubble: {
    flex: 1,
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    borderRadius: radius.surface,
    borderBottomLeftRadius: 6,
    padding: space[4],
    marginBottom: space[2],
  },
  coachText: { marginTop: 4 },
  ticks: { marginTop: space[5] },
  section: { marginTop: space[8] },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[3] },
  strengths: { gap: space[3] },
  strength: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  tryNext: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'center',
    backgroundColor: color.soft,
    borderRadius: radius.surface,
    padding: space[5],
  },
  tryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  options: { gap: space[3] },
  option: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  optionIconPick: { backgroundColor: color.white },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  reviewWrap: { marginTop: space[6] },
  review: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  sentTick: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center' },
  footnote: { marginTop: space[6], paddingHorizontal: space[4] },
});

function reviewRowTitle(status: 'submitted' | 'reviewed' | 'withdrawn', trainerName: string, reviewedBy?: string) {
  if (reviewedBy || status === 'reviewed') return `Reviewed by ${reviewedBy ?? trainerName}`;
  return `Sent to ${trainerName}`;
}
