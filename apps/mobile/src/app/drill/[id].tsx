import { getDrill, getSkill, getSkillLevel, streakAfterPractice, type Drill, type DrillFeedback } from '@antelope/core';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOutDown, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ChoiceTiles } from '@/components/drill/ChoiceTiles';
import { FeedbackPanel } from '@/components/drill/FeedbackPanel';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { CompletionMoment, usePracticeSnapshot } from '@/components/practice-loop/Completion';
import { Composer } from '@/components/practice-loop/Composer';
import { ErrorIcon, SaveProgressLink } from '@/components/practice-loop/ErrorBits';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { Dock, KeyboardColumn, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { HeroTarget, SessionSurface, useSession, useSessionClose } from '@/components/practice-loop/SessionSurface';
import { CoachSays, InstructionChip, LearnerBubble, SpeechCard, useComposerLaunch } from '@/components/practice-loop/Speech';
import { SunArc } from '@/components/practice-loop/SunArc';
import { Shimmer } from '@/components/practice-loop/Thinking';
import { ArrowRightIcon, Button, Chip, Hoofprint, LevelPips, Raised, Text, TextLink, color, drillSpeakerAvatar, haptic, layout, radius, space } from '@/design';
import { nextDrillId } from '@/data/routes';
import { postJson } from '@/lib/api';
import { practiceSource, track } from '@/lib/analytics';
import { Enter, Expand, FADE_MS, RollingNumber, spring, useFades, useForwardSwap, useReduceMotion } from '@/motion';
import { activePathwayId, today, useLearner } from '@/state/store';

/**
 * The daily habit loop. One drill at a time; "One more?" chains through the
 * course activity's drills and then DAILY_DRILL_ORDER. The session counts as
 * one practice (recorded on the first finished rep, so closing early never
 * loses it); "I'm done" shows the streak and weekly ring tick.
 */
export default function DrillScreen() {
  return (
    <SessionSurface>
      <DrillSession />
    </SessionSurface>
  );
}

function DrillSession() {
  const close = useSessionClose();
  // arriving from a hero source (Home's card, a Practice tile): its title lands in the header
  const heroTitle = useSession()?.title;
  const swap = useForwardSwap();
  const [reps, setReps] = useState(0);
  const { id, activityId, minutes, source } = useLocalSearchParams<{ id: string; activityId?: string; minutes?: string; source?: string }>();
  const [drillId, setDrillId] = useState(id);
  const [done, setDone] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const before = usePracticeSnapshot();
  const recordPractice = useLearner((s) => s.recordPractice);
  const recordSession = useLearner((s) => s.recordSession);
  const recorded = useRef(false);
  const [day] = useState(() => {
    const s = useLearner.getState();
    return streakAfterPractice(s.streak, today(), s.freezes).streak.days;
  });
  const mins = Number(minutes) || 5;
  const drill = getDrill(drillId);

  useEffect(() => {
    const d = getDrill(id);
    track('practice_started', { kind: 'drill', ref_id: id, ...(d ? { skill: d.skill, level: d.level } : {}), source: practiceSource(source), pathway_id: activePathwayId(), mode: 'text' });
    // once per screen: "One more" reports its own start below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repDone = (d: Drill, rep: RepResult) => {
    setDone((xs) => (xs.includes(d.id) ? xs : [...xs, d.id]));
    // every rep is kept as a practice session (what was said, what the coach saw)
    const ended = new Date();
    recordSession({
      kind: 'drill',
      refId: d.id,
      skill: d.skill,
      transcript: [
        { id: 't0', speaker: 'employee', text: d.prompt },
        { id: 't1', speaker: 'learner', text: rep.response },
      ],
      debrief: rep.feedback ?? { picks: rep.picks ?? [], hitTarget: !!rep.hit },
      startedAt: rep.startedAt,
      endedAt: ended.toISOString(),
      durationSec: Math.max(0, (ended.getTime() - new Date(rep.startedAt).getTime()) / 1000),
    });
    if (recorded.current) return;
    recorded.current = true;
    recordPractice({ kind: 'drill', skill: d.skill, refId: id, activityId, minutes: mins });
  };

  const oneMore = () => {
    const next = nextDrillId(drillId, done, activityId);
    track('next_step_chosen', { from: 'drill', choice: 'one_more' });
    const d = getDrill(next);
    track('practice_started', { kind: 'drill', ref_id: next, ...(d ? { skill: d.skill, level: d.level } : {}), source: 'next_step', pathway_id: activePathwayId(), mode: 'text' });
    setReps((n) => n + 1);
    setComplete(false);
    setDrillId(next);
  };

  const finish = () => {
    track('next_step_chosen', { from: 'drill', choice: 'done' });
    setReps((n) => n + 1);
    setComplete(true);
  };

  // the daily rep (Home's card or a reminder): a sun crosses the landscape over its two minutes
  const isDailyRep = source === 'today';
  const header = (
    <>
    <SessionHeader
      onClose={close}
      center={
        heroTitle ? (
          <View style={styles.headCenter}>
            <HeroTarget name="title" fontSize={18}>
              <Text variant="subheading" numberOfLines={1}>
                {heroTitle}
              </Text>
            </HeroTarget>
            <Text variant="caption" color={color.muted}>
              Day {day} · {mins} minutes today
            </Text>
          </View>
        ) : (
          <View style={styles.headCenter}>
            <Text variant="subheading">Day {day}</Text>
            <Text variant="caption" color={color.muted}>
              {mins} minutes of MI practice today
            </Text>
          </View>
        )
      }
      trailing={<RepCounter count={done.length} />}
    />
    {isDailyRep ? <SunArc done={done.length > 0} minutes={mins} /> : null}
    </>
  );

  if (complete) {
    const n = done.length;
    return (
      <View style={sessionStyles.root}>
        {header}
        <Animated.View key="complete" entering={swap.entering} exiting={swap.exiting} style={styles.completeBody}>
          <CompletionMoment
            title={n > 1 ? `${n} reps. That’s practice.` : 'One rep, done.'}
            subtitle="Small reps, most days. That’s how this becomes the way you talk."
            before={before}
          >
            <Dock rule={false} style={styles.flush}>
              <Button label="Done" fullWidth onPress={close} />
              <Button variant="secondary" label="One more" fullWidth onPress={oneMore} style={styles.second} />
            </Dock>
          </CompletionMoment>
        </Animated.View>
      </View>
    );
  }

  if (!drill) {
    return (
      <View style={sessionStyles.root}>
        {header}
        <View style={styles.completeBody}>
          <Text variant="heading" align="center">
            That drill isn’t here yet.
          </Text>
        </View>
      </View>
    );
  }

  // "One more": the finished rep leaves to the left as the next one arrives from the right
  return (
    <View style={sessionStyles.root}>
      {header}
      <Animated.View key={`${drill.id}-${reps}`} entering={reps ? swap.entering : undefined} exiting={swap.exiting} style={styles.flex}>
        <DrillRep drill={drill} onRepDone={(rep) => repDone(drill, rep)} onOneMore={oneMore} onDone={finish} />
      </Animated.View>
    </View>
  );
}

type Phase = 'answer' | 'waiting' | 'feedback' | 'error';

/** One finished rep: the learner's words (or picks) and the coach's read. */
interface RepResult {
  response: string;
  feedback?: DrillFeedback;
  picks?: string[];
  hit?: boolean;
  startedAt: string;
}

function DrillRep({ drill, onRepDone, onOneMore, onDone }: { drill: Drill; onRepDone: (rep: RepResult) => void; onOneMore: () => void; onDone: () => void }) {
  const [repStarted] = useState(() => new Date().toISOString());
  const focused = useIsFocused();
  const scroll = useRef<ScrollView>(null);
  const coach = useRef<MascotHandle>(null);
  // choices
  const [selected, setSelected] = useState<number[]>([]);
  const targets = drill.choices?.map((c, i) => (c.isTarget ? i : -1)).filter((i) => i >= 0) ?? [];
  const multi = targets.length > 1;
  const [revealed, setRevealed] = useState(false);
  // free text
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answer');
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const inflight = useRef<ReturnType<typeof withTimeout> | null>(null);
  const reduce = useReduceMotion();
  const fades = useFades(200, 140);
  // the composer drops away as your words lift out of it
  const composerOut = reduce ? fades.exiting : FadeOutDown.duration(200).reduceMotion(ReduceMotion.Never);

  useEffect(() => () => inflight.current?.abort(), []);

  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);

  // ---- choices: local evaluation
  const check = () => {
    if (!selected.length || !drill.choices) return;
    // haptics + bursts are ChoiceTiles' (on the check frame); the coach hops from onResolved
    setRevealed(true);
    const picks = selected.map((i) => drill.choices![i].text);
    const got = selected.filter((i) => targets.includes(i)).length;
    const hitAll = got === targets.length && selected.length === targets.length;
    track('drill_answered', { drill_id: drill.id, skill: drill.skill, level: drill.level, format: 'choice', hit_target: hitAll });
    onRepDone({ response: picks.join(' / '), picks, hit: hitAll, startedAt: repStarted });
    toEnd();
  };

  // ---- free text: the coach reads it
  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setSubmitted(text);
    setPhase('waiting');
    setError(null);
    toEnd();
    const req = withTimeout(25_000);
    inflight.current = req;
    const started = Date.now();
    try {
      const fb = await postJson<DrillFeedback>('/api/drill/feedback', { drillId: drill.id, response: text }, req.signal);
      // real round trip, measured before the pause below that lets the listening moment land
      const latency = Date.now() - started;
      // let the listening moment land even when the reply is instant
      const wait = Math.max(0, 1100 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (req.signal.aborted) return;
      // ids and enums only: never the learner's words or the coach's feedback text
      track('drill_answered', { drill_id: drill.id, skill: drill.skill, level: drill.level, format: 'text', hit_target: !!fb.hitTarget });
      track('drill_feedback_received', { drill_id: drill.id, latency_ms: latency, move: fb.move, hit_target: !!fb.hitTarget });
      setFeedback({ ...fb, possibleResponses: fb.possibleResponses ?? [] });
      setPhase('feedback');
      onRepDone({ response: text, feedback: { ...fb, possibleResponses: fb.possibleResponses ?? [] }, startedAt: repStarted });
      // FeedbackPanel owns the hit/miss haptics, on its chip pop
    } catch (e) {
      if (inflight.current !== req) return;
      setError(friendlyError(e));
      setPhase('error');
      haptic.warn();
    } finally {
      req.clear();
    }
  };

  const editAgain = () => {
    setPhase('answer');
    setSubmitted(null);
    setFeedback(null);
  };

  // the panel drops away first (FeedbackPanel open=false → onExited), then the rep resets
  const [leavingPanel, setLeavingPanel] = useState<null | 'retry'>(null);
  const tryAgain = () => {
    track('next_step_chosen', { from: 'drill', choice: 'try_again' });
    setLeavingPanel('retry');
  };
  const panelExited = () => {
    setLeavingPanel(null);
    setDraft('');
    editAgain();
  };

  const caught = selected.filter((i) => targets.includes(i)).length;
  const hit = revealed && caught === targets.length && selected.length === targets.length;
  const partial = revealed && !hit && caught > 0;
  const level = getSkillLevel(drill.level);

  return (
    <KeyboardColumn>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[sessionStyles.scroll, styles.content, phase === 'feedback' && styles.contentUnderPanel]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={sessionStyles.column}>
          <Enter style={styles.chips}>
            <Chip label={getSkill(drill.skill).name} tone="soft" />
            <Chip
              label={`Level ${drill.level} · ${level.name}`}
              tone="neutral"
              icon={<LevelPips level={drill.level} percent={100} pipWidth={8} height={5} gap={2} delay={300} />}
            />
          </Enter>

          <View style={styles.block}>
            <SpeechCard context={drill.context} speaker={drill.speaker} avatar={drillSpeakerAvatar(drill)} line={drill.prompt} />
          </View>

          <Enter delay={560} style={styles.block}>
            <InstructionChip text={drill.instruction} />
          </Enter>

          {drill.choices ? (
            <View style={styles.block}>
              {multi ? (
                <Text variant="caption" color={color.muted} style={styles.multi}>
                  More than one fits. Pick all that apply.
                </Text>
              ) : null}
              <ChoiceTiles
                choices={drill.choices}
                selected={selected}
                revealed={revealed}
                multi={multi}
                onResolved={(hit) => hit && coach.current?.hop()}
                onSelect={(i) => {
                  if (revealed) return;
                  setSelected((xs) => (multi ? (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]) : [i]));
                }}
              />
            </View>
          ) : null}

          {revealed ? (
            <Expand delay={420}>
              <View style={styles.block}>
              <CoachSays ref={coach} pose="head" size={60} paused={!focused}>
                <Text variant="body">
                  {hit
                    ? 'Nice ear. Spotting it is the first step to using it on purpose.'
                    : partial
                      ? 'You caught part of it. Read the ones you didn’t pick; that’s where the learning is.'
                      : 'Not the one the drill was after, and that’s useful to notice. Read why each one lands the way it does.'}
                </Text>
              </CoachSays>
              </View>
            </Expand>
          ) : null}

          {submitted ? <Submitted text={submitted} /> : null}

          {phase === 'waiting' ? (
            <Animated.View exiting={fades.exiting}>
            <Enter delay={250} style={[styles.block, styles.listening]}>
              <Mascot pose="head" mood="listening" size={58} paused={!focused} accessibilityLabel="The antelope coach, listening" />
              <View style={styles.listeningCopy}>
                <Text variant="label" color={color.muted}>
                  Listening to how that lands…
                </Text>
                <Shimmer width={150} />
              </View>
            </Enter>
            </Animated.View>
          ) : null}

          {phase === 'error' && error ? (
            <Expand>
              <View style={styles.block}>
              <Raised tone="surface" depth={4} contentStyle={styles.errorFace}>
                <View style={styles.errorIcon}>
                  <ErrorIcon error={error} size={22} />
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading">{error.title}</Text>
                  <Text variant="body" color={color.muted}>
                    {error.detail} Your response is saved.
                  </Text>
                  <SaveProgressLink error={error} style={styles.errorLink} />
                </View>
              </Raised>
              </View>
            </Expand>
          ) : null}
        </View>
      </ScrollView>

      {drill.choices ? (
        <Dock>
          {revealed ? (
            <>
              <Button label="One more" fullWidth onPress={onOneMore} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
              <TextLink label="I’m done" onPress={onDone} />
            </>
          ) : (
            <Button label="Check" fullWidth disabled={!selected.length} onPress={check} />
          )}
        </Dock>
      ) : phase === 'answer' ? (
        <Animated.View exiting={composerOut}>
        <Dock>
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={submit}
            placeholder="Type what you’d say…"
            accessibilityLabel={`Your response to: ${drill.prompt}`}
          />
        </Dock>
        </Animated.View>
      ) : phase === 'error' ? (
        <Dock>
          <Button label="Try again" fullWidth onPress={submit} />
          <TextLink label="Edit my response" onPress={editAgain} />
        </Dock>
      ) : null}

      {phase === 'feedback' && feedback ? (
        <FeedbackPanel
          feedback={feedback}
          open={!leavingPanel}
          onExited={panelExited}
          paused={!focused}
          actions={
            <>
              <Button label="One more" fullWidth onPress={onOneMore} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
              <View style={styles.linkRow}>
                <TextLink label="Try this one again" onPress={tryAgain} />
                <View style={styles.linkDot} />
                <TextLink label="I’m done" onPress={onDone} />
              </View>
            </>
          }
        />
      ) : null}
    </KeyboardColumn>
  );
}

/** Your words, launched out of the composer as it drops away. */
function Submitted({ text }: { text: string }) {
  const launch = useComposerLaunch();
  const fades = useFades(220);
  return (
    <View style={styles.block}>
      <Animated.View entering={fades.entering}>
        <Text variant="caption" color={color.muted} align="right" style={styles.you}>
          You
        </Text>
      </Animated.View>
      <Animated.View ref={launch.ref} onLayout={launch.onLayout} collapsable={false} style={launch.style}>
        <LearnerBubble text={text} />
      </Animated.View>
    </View>
  );
}

/**
 * Reps this session: a hoofprint and a rolling count that pops when it ticks.
 * It stays invisible (and keeps its slot, so the title doesn't shift) until the
 * first rep lands, then fades in as the count rolls to 1.
 */
function RepCounter({ count }: { count: number }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const shown = useSharedValue(count > 0 ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(count > 0 ? 1 : 0, { duration: FADE_MS });
    if (count > 0 && !reduce) pop.value = withSequence(withSpring(1.18, spring.snappy), withSpring(1, spring.bouncy));
  }, [count, reduce, pop, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      style={[styles.reps, styles.repsOn, style]}
      accessible={count > 0}
      accessibilityElementsHidden={count === 0}
      importantForAccessibility={count > 0 ? 'auto' : 'no-hide-descendants'}
      pointerEvents="none"
      accessibilityLabel={`${count} ${count === 1 ? 'rep' : 'reps'} this session`}
    >
      <Hoofprint size={16} tint={color.gold} rotate={-12} />
      <RollingNumber value={count} variant="label" color={color.goldInk} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headCenter: { alignItems: 'center' },
  content: { paddingTop: space[2], paddingBottom: space[6] },
  contentUnderPanel: { paddingBottom: 520 },
  chips: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  block: { marginTop: space[5] },
  you: { marginBottom: 4, marginRight: 4 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  listeningCopy: { gap: space[2] },
  errorFace: { flexDirection: 'row', gap: space[3], padding: space[4], alignItems: 'flex-start' },
  errorLink: { marginTop: space[2], alignSelf: 'flex-start' },
  errorIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  linkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.line },
  reps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: color.soft,
  },
  repsOn: { backgroundColor: color.goldTint },
  multi: { marginBottom: space[3] },
  completeBody: { flex: 1, paddingHorizontal: layout.gutter, justifyContent: 'center' },
  flush: { paddingHorizontal: 0 },
  second: { marginTop: space[3] },
});
