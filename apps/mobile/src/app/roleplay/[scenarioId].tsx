import { SCENARIOS, getScenario, type Debrief as DebriefData, type MoveTallies, type ScenarioSpec, type SelfReflection, type Turn } from '@antelope/core';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { usePracticeSnapshot } from '@/components/practice-loop/Completion';
import { ErrorIcon, SaveProgressLink } from '@/components/practice-loop/ErrorBits';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { SessionSurface, useSessionClose } from '@/components/practice-loop/SessionSurface';
import { CoachThinking } from '@/components/practice-loop/Thinking';
import { Brief } from '@/components/roleplay/Brief';
import { Conversation } from '@/components/roleplay/Conversation';
import { Debrief, type NextChoice } from '@/components/roleplay/Debrief';
import { Reflection } from '@/components/roleplay/Reflection';
import type { VoiceFallback } from '@/components/roleplay/voice/useVoiceTurn';
import type { ReplyMode } from '@/components/roleplay/voice/VoiceBits';
import { canRecordHere, markVoiceResting, voiceAvailable } from '@/components/roleplay/voice/voiceSupport';
import { Avatar, Button, Raised, Text, color, haptic, layout, scenarioAvatar, space, type AvatarIdentity } from '@/design';
import { scenariosForSetting } from '@/data/pathways';
import { openDrill, openRoleplay, pickDrill } from '@/data/routes';
import { postJson } from '@/lib/api';
import { practiceSource, track } from '@/lib/analytics';
import { FADE_MS, useReduceMotion } from '@/motion';
import { Platform } from 'react-native';
import type { Rect } from '@/motion/launch';
import { activePathwayId, useLearner, type PracticeSession } from '@/state/store';

type Params = { scenarioId: string; activityId?: string; minutes?: string; source?: string };

export default function RoleplayScreen() {
  const params = useLocalSearchParams<Params>();
  const scenario = getScenario(params.scenarioId);
  // a fresh flow per scenario (e.g. after "Try a harder scenario" replaces this screen)
  return <SessionSurface>{scenario ? <RoleplayFlow key={scenario.id} scenario={scenario} params={params} /> : <Missing />}</SessionSurface>;
}

type Phase = 'brief' | 'chat' | 'reflect' | 'thinking' | 'debrief';

const THINKING_LINES = [
  'Reading back through your reflections…',
  'Noticing where the conversation shifted…',
  'Finding a moment worth replaying…',
  'Choosing one thing to try next…',
];

/**
 * Brief → conversation → self-reflection → (coach reads) → debrief.
 * Reflection always comes before AI feedback; the debrief request carries it.
 */
function RoleplayFlow({ scenario, params }: { scenario: ScenarioSpec; params: Params }) {
  const close = useSessionClose();
  const root = useRef<View>(null);
  // brief → conversation: the person's portrait walks with you into the meeting and takes its seat in the header
  const [flight, setFlight] = useState<{ from: Rect; to?: Rect } | null>(null);
  const [entered, setEntered] = useState(false);
  // they open in the scenario's starting stance, so the portrait starts where they are
  const opening: Turn[] = [{ id: 't0', speaker: 'employee', text: scenario.openingLine, stance: scenario.desiredTrajectory[0] }];
  const [phase, setPhase] = useState<Phase>('brief');
  const [session, setSession] = useState(0);
  const [turns, setTurns] = useState<Turn[]>(opening);
  const [reflection, setReflection] = useState<SelfReflection | null>(null);
  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [saved, setSaved] = useState<PracticeSession | null>(null);
  const before = usePracticeSnapshot();
  const recordPractice = useLearner((s) => s.recordPractice);
  const recordSession = useLearner((s) => s.recordSession);
  // when this conversation started (the brief's START), for the session's duration
  const startedAt = useRef(new Date().toISOString());
  const inflight = useRef<ReturnType<typeof withTimeout> | null>(null);
  // Talk or Type: the learner's last pick, else Type. Talk is opt-in until voice
  // capture is verified on real iPhones (the simulator's mic records silence).
  const setSetting = useLearner((s) => s.setSetting);
  const [mode, setMode] = useState<ReplyMode>(() => {
    const saved = useLearner.getState().settings.roleplayMode;
    return voiceAvailable() && saved === 'talk' ? 'talk' : 'type';
  });
  const [fallback, setFallback] = useState<string | null>(null);
  /** Spoken turns in this conversation: any at all and the session is saved as `voice`. */
  const voiceTurns = useRef(0);
  const [source] = useState(() => practiceSource(params.source));

  useEffect(() => () => inflight.current?.abort(), []);

  const pickMode = (m: ReplyMode) => {
    setMode(m);
    setSetting('roleplayMode', m);
    setFallback(null);
  };

  const onFallback = (why: VoiceFallback) => {
    setMode('type');
    if (why === 'permission') {
      // keep asking for a mic they've said no to and Talk would fail every time; they can pick it again
      setSetting('roleplayMode', 'type');
      setFallback(
        Platform.OS === 'web'
          ? 'The browser didn’t share your mic, so let’s type. You can allow it in the site settings.'
          : 'Your mic is off for this app, so let’s type. You can turn it on in Settings.',
      );
    } else {
      markVoiceResting();
      setFallback('Voice is taking a break, so let’s type for now.');
    }
  };

  const requestDebrief = async (r: SelfReflection, t: Turn[]) => {
    setPhase('thinking');
    setError(null);
    const req = withTimeout(45_000);
    inflight.current?.abort();
    inflight.current = req;
    const started = Date.now();
    try {
      const d = await postJson<DebriefData>('/api/roleplay/debrief', { scenarioId: scenario.id, turns: t, selfReflection: r }, req.signal);
      const latency = Date.now() - started;
      // the coach takes a moment: long enough to read as intentional, never padded past ~2.4s
      await new Promise((res) => setTimeout(res, Math.max(0, 2400 - (Date.now() - started))));
      if (inflight.current !== req) return;
      const nd = normalize(d);
      setDebrief(nd);
      setPhase('debrief');
      track('debrief_viewed', { scenario_id: scenario.id, latency_ms: latency, suggested_next_step: nd.suggestedNextStep, pathway_id: activePathwayId() });
      const ended = new Date();
      // the conversation itself, kept so it syncs and can be shared with a trainer
      setSaved(
        recordSession({
          kind: 'roleplay',
          refId: scenario.id,
          skill: scenario.primaryChallenge,
          transcript: t,
          debrief: nd,
          selfReflection: r,
          startedAt: startedAt.current,
          endedAt: ended.toISOString(),
          durationSec: Math.max(0, (ended.getTime() - new Date(startedAt.current).getTime()) / 1000),
          mode: voiceTurns.current > 0 ? 'voice' : 'text',
        }),
      );
      recordPractice({
        kind: 'roleplay',
        skill: scenario.primaryChallenge,
        refId: scenario.id,
        activityId: params.activityId,
        minutes: Number(params.minutes) || 10,
      });
    } catch (e) {
      if (inflight.current !== req) return;
      setError(friendlyError(e));
      haptic.warn();
    } finally {
      req.clear();
    }
  };

  const restart = () => {
    track('practice_started', {
      kind: 'roleplay',
      ref_id: scenario.id,
      skill: scenario.primaryChallenge,
      source: 'next_step',
      pathway_id: activePathwayId(),
      mode: mode === 'talk' ? 'voice' : 'text',
    });
    voiceTurns.current = 0;
    setTurns(opening);
    setReflection(null);
    setDebrief(null);
    setSaved(null);
    startedAt.current = new Date().toISOString();
    setSession((n) => n + 1);
    setPhase('chat');
  };

  const next = (c: NextChoice) => {
    track('next_step_chosen', {
      from: 'debrief',
      choice: c === 'try-again' ? 'try_again' : c === 'same-skill' ? 'same_skill' : c === 'harder' ? 'harder' : 'new_scenario',
    });
    if (c === 'try-again') return restart();
    if (c === 'same-skill') {
      const lvl = useLearner.getState().skills[scenario.primaryChallenge]?.level ?? 1;
      return openDrill(pickDrill(scenario.primaryChallenge, lvl, scenario.setting), { minutes: 5, source: 'next_step', replace: true });
    }
    const target = c === 'harder' ? scenario.harderId : c === 'easier' ? scenario.easierId : randomOther(scenario);
    if (target) openRoleplay(target, { minutes: 12, source: 'next_step', replace: true });
  };

  let body: ReactNode;
  const startChat = (avatar: View | null) => {
    // one start per role-play screen, sent as the conversation begins (with how they'll reply); "Try again" reports its own
    track('practice_started', {
      kind: 'roleplay',
      ref_id: scenario.id,
      skill: scenario.primaryChallenge,
      source,
      pathway_id: activePathwayId(),
      mode: mode === 'talk' ? 'voice' : 'text',
    });
    setEntered(true);
    startedAt.current = new Date().toISOString();
    const node = root.current;
    if (!avatar || !node) return setPhase('chat');
    avatar.measureLayout(
      node,
      (x, y, width, height) => {
        setFlight({ from: { x, y, width, height } });
        setPhase('chat');
      },
      () => setPhase('chat'),
    );
  };

  const onSeat = useCallback((avatar: View | null) => {
    const node = root.current;
    if (!avatar || !node) return;
    avatar.measureLayout(node, (x, y, width, height) => setFlight((f) => (f && !f.to ? { ...f, to: { x, y, width, height } } : f)), () => setFlight(null));
  }, []);

  if (phase === 'brief')
    body = (
      <Brief
        scenario={scenario}
        onStart={startChat}
        onClose={close}
        mode={mode}
        onMode={pickMode}
        talkNote={voiceAvailable() ? undefined : canRecordHere() ? 'Resting right now' : 'Not in this browser'}
      />
    );
  else if (phase === 'chat')
    body = (
      <Conversation
        key={session}
        scenario={scenario}
        turns={turns}
        onTurns={setTurns}
        onEnd={(t) => {
          setTurns(t);
          setPhase('reflect');
        }}
        onLeave={close}
        arriving={entered && !!flight}
        seatHidden={!!flight}
        onSeat={onSeat}
        mode={mode}
        onMode={pickMode}
        onFallback={onFallback}
        fallbackNote={fallback}
        onVoiceTurn={() => {
          voiceTurns.current += 1;
        }}
      />
    );
  else if (phase === 'reflect')
    body = (
      <Reflection
        name={scenario.persona.name}
        initial={reflection}
        onClose={close}
        onSubmit={(r) => {
          setReflection(r);
          track('reflection_submitted', { scenario_id: scenario.id, feeling: r.feeling });
          requestDebrief(r, turns);
        }}
      />
    );
  else if (phase === 'thinking')
    body = (
      <Thinking
        error={error}
        onRetry={() => reflection && requestDebrief(reflection, turns)}
        onBack={() => {
          inflight.current?.abort();
          setError(null);
          setPhase('reflect');
        }}
        onClose={close}
      />
    );
  else if (debrief && reflection)
    body = (
      <Debrief
        scenario={scenario}
        turns={turns}
        reflection={reflection}
        debrief={debrief}
        before={before}
        session={saved}
        onNext={next}
        onClose={close}
      />
    );

  return (
    <View ref={root} collapsable={false} style={styles.fill}>
      {/* the first phase arrives with the screen itself (SessionSurface), so it doesn't animate twice */}
      <Phase
        key={`${phase}-${session}`}
        enter={phase === 'brief' ? 'none' : phase === 'chat' && session === 0 ? 'meeting' : 'step'}
        exit={phase === 'brief' ? 'meeting' : 'step'}
      >
        {body}
      </Phase>
      {flight?.to ? <AvatarFlight avatar={scenarioAvatar(scenario)} from={flight.from} to={flight.to} onLanded={() => setFlight(null)} /> : null}
    </View>
  );
}

/*
 * Phase transitions.
 *
 *   step     (chat → reflect → thinking → debrief): the old phase fades out (120ms) while the new one rises
 *            16pt into place (spring-like ease, 300ms). Reads as "next page", not "new screen".
 *   meeting  (brief → conversation, "walking into the meeting"):
 *            0-240   the brief moves past you: scales up 6%, drifts up and fades (ease-in, like stepping through it)
 *            60-420  the conversation comes into focus: from 96% scale + transparent to rest (ease-out)
 *            0-460   the person's portrait flies from the brief into its seat in the header (AvatarFlight)
 *            ~400    they speak: the opening line rises in once you've sat down
 * Reduced motion: cross-fades only.
 */
const STEP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
})
  .duration(300)
  .reduceMotion(ReduceMotion.Never);
const STEP_OUT = FadeOut.duration(120).reduceMotion(ReduceMotion.Never);
const MEETING_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
})
  .duration(360)
  .delay(60)
  .reduceMotion(ReduceMotion.Never);
const MEETING_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -14 }, { scale: 1.06 }], easing: Easing.in(Easing.quad) },
})
  .duration(240)
  .reduceMotion(ReduceMotion.Never);
const FADE_IN = FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.Never);

function Phase({ enter, exit, children }: { enter: 'none' | 'step' | 'meeting'; exit: 'step' | 'meeting'; children: ReactNode }) {
  const reduce = useReduceMotion();
  const entering = enter === 'none' ? undefined : reduce ? FADE_IN : enter === 'meeting' ? MEETING_IN : STEP_IN;
  const exiting = reduce || exit === 'step' ? STEP_OUT : MEETING_OUT;
  return (
    // phases stack (absolute) so an exiting phase never holds layout space from the arriving one
    <Animated.View entering={entering} exiting={exiting} style={[StyleSheet.absoluteFill, styles.phase]}>
      {children}
    </Animated.View>
  );
}

/** The persona's portrait travelling from the brief to the conversation header. */
function AvatarFlight({ avatar, from, to, onLanded }: { avatar: AvatarIdentity; from: Rect; to: Rect; onLanded: () => void }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const s = useSharedValue(0);
  useEffect(() => {
    if (reduce) return onLanded();
    const landed = (f?: boolean) => {
      'worklet';
      if (f) scheduleOnRN(onLanded);
    };
    // y leads x slightly (stiffer), so the path curves up and over rather than cutting a straight diagonal
    x.value = withSpring(1, { damping: 26, stiffness: 190, mass: 1 });
    y.value = withSpring(1, { damping: 26, stiffness: 260, mass: 1 });
    s.value = withSpring(1, { damping: 24, stiffness: 230, mass: 1 }, landed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = from.width;
  const style = useAnimatedStyle(() => {
    const cx = from.x + from.width / 2 + (to.x + to.width / 2 - (from.x + from.width / 2)) * x.value;
    const cy = from.y + from.height / 2 + (to.y + to.height / 2 - (from.y + from.height / 2)) * y.value;
    const k = 1 + (to.width / from.width - 1) * s.value;
    return { transform: [{ translateX: cx - size / 2 }, { translateY: cy - size / 2 }, { scale: k }] };
  });
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.flight, { width: size, height: size }, style]}>
      <Avatar {...avatar} size={size} ring={color.white} />
    </Animated.View>
  );
}

function Thinking({ error, onRetry, onBack, onClose }: { error: FriendlyError | null; onRetry: () => void; onBack: () => void; onClose: () => void }) {
  const focused = useIsFocused();
  return (
    <View style={sessionStyles.root}>
      <SessionHeader onClose={onClose} />
      <View style={styles.center}>
        {error ? (
          <Raised tone="surface" depth={5} contentStyle={styles.errorFace}>
            <ErrorIcon error={error} size={28} />
            <Text variant="heading" align="center">
              {error.title}
            </Text>
            <Text variant="body" color={color.muted} align="center">
              {error.detail} Your conversation and reflection are saved.
            </Text>
            <SaveProgressLink error={error} />
          </Raised>
        ) : (
          <CoachThinking title="Reading the conversation" lines={THINKING_LINES} paused={!focused} />
        )}
      </View>
      {error ? (
        <Dock rule={false}>
          <Button label="Try again" fullWidth onPress={onRetry} />
          <Button variant="secondary" label="Back to my reflection" fullWidth onPress={onBack} style={styles.second} />
        </Dock>
      ) : null}
    </View>
  );
}

const EMPTY_TALLIES: MoveTallies = {
  openQuestions: 0,
  closedQuestions: 0,
  simpleReflections: 0,
  complexReflections: 0,
  affirmations: 0,
  summaries: 0,
  autonomySupport: 0,
  miInconsistent: 0,
};

/** Defensive defaults so a partial model response never breaks the screen. */
function normalize(d: DebriefData): DebriefData {
  return {
    annotations: d.annotations ?? [],
    tallies: { ...EMPTY_TALLIES, ...(d.tallies as Partial<MoveTallies> | undefined) },
    trajectory: (d.trajectory ?? []).map((v) => Math.max(-2, Math.min(2, Number(v) || 0))),
    reflectionResponse: d.reflectionResponse ?? '',
    strengths: d.strengths ?? [],
    keyMoments: (d.keyMoments ?? []).map((k) => ({ ...k, possibleResponses: k.possibleResponses ?? [] })),
    tryNext: d.tryNext ?? '',
    suggestedNextStep: d.suggestedNextStep ?? 'try-again',
  };
}

/** A different scenario in the same setting (all scenarios if that setting has no other). */
function randomOther(scenario: ScenarioSpec): string | undefined {
  const same = scenariosForSetting(scenario.setting).filter((s) => s.id !== scenario.id);
  const pool = same.length ? same : SCENARIOS.filter((s) => s.id !== scenario.id);
  return pool[Math.floor(Math.random() * pool.length)]?.id;
}

function Missing() {
  const close = useSessionClose();
  return (
    <View style={sessionStyles.root}>
      <SessionHeader onClose={close} />
      <View style={styles.center}>
        <Text variant="heading" align="center">
          That scenario isn’t here yet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.white },
  flight: { position: 'absolute', left: 0, top: 0, zIndex: 20 },
  phase: { backgroundColor: color.white },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.gutter },
  errorFace: { alignItems: 'center', gap: space[3], padding: space[6] },
  second: { marginTop: space[3] },
});
