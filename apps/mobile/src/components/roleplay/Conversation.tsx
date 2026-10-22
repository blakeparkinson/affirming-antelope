import { liveMoments, moveLines, scenarioFrame, staggerTimes, type MoveTier, type ScenarioSpec, type Stance, type Turn } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Composer, setLaunchPad } from '@/components/practice-loop/Composer';
import { ConfirmSheet } from '@/components/practice-loop/ConfirmSheet';
import { SaveProgressLink } from '@/components/practice-loop/ErrorBits';
import { MOVE } from '@/components/practice-loop/moves';
import { callName, conversationLabel } from '@/components/practice-loop/names';
import { Dock, KeyboardColumn, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { EmployeeBubble, LearnerBubble, LiveEmployeeBubble, useBubbleEntrance, useComposerLaunch } from '@/components/practice-loop/Speech';
import {
  ArrowCounterClockwiseIcon,
  Avatar,
  MicrophoneSlashIcon,
  Button,
  CaretDownIcon,
  PressableSurface,
  TargetIcon,
  Text,
  color,
  haptic,
  layout,
  radius,
  space,
  scenarioAvatar,
  type AvatarIdentity,
} from '@/design';
import { track } from '@/lib/analytics';
import { useLearner } from '@/state/store';
import { FADE_MS, spring, useFades, useListLayout, useReduceMotion, useTickSwap } from '@/motion';
import { BubbleSheen, MoveStamp, type Stamp } from './MoveStamp';
import { PersonaPresence, WarmthThread, useWarmth } from './Presence';
import { answeredExchanges, endSheetBody, failedTurnLine } from './turnFlow';
import { useEmployeeReply, type ReplyRead } from './useEmployeeReply';
import { TalkDock } from './voice/TalkDock';
import { useVoiceTurn, type VoiceFallback } from './voice/useVoiceTurn';
import { MuteToggle, SpeakingRing, type ReplyMode } from './voice/VoiceBits';

const MIN_TURNS = 3;

/**
 * The conversation. Feels like talking to a person, not a bot: the opening
 * line is already there, replies take a beat (typing dots) and then arrive at
 * a speaking pace. Auto-scroll follows the conversation unless you've scrolled
 * up to reread; then a "New reply" pill offers the way back. No live scores: your
 * skill shows only as a marker that pops onto your own bubble when the reply comes
 * back (MoveStamp), never as words.
 */
export function Conversation({
  scenario,
  turns,
  onTurns,
  onEnd,
  onLeave,
  arriving,
  seatHidden,
  onSeat,
  mode = 'type',
  onMode,
  onFallback,
  fallbackNote,
  onVoiceTurn,
}: {
  scenario: ScenarioSpec;
  turns: Turn[];
  onTurns: (t: Turn[]) => void;
  onEnd: (t: Turn[]) => void;
  onLeave: () => void;
  /** Walking in from the brief: the opening line waits until you've sat down. */
  arriving?: boolean;
  /** The header portrait is still in flight from the brief. */
  seatHidden?: boolean;
  /** Where the flying portrait should land. */
  onSeat?: (node: View | null) => void;
  /** Talk (hold-to-talk mic) or Type (the composer). */
  mode?: ReplyMode;
  /** The learner switched mid-conversation ("Type instead"). */
  onMode?: (m: ReplyMode) => void;
  /** Talk can't carry on (mic denied, voice off on the server): switch to Type. */
  onFallback?: (why: VoiceFallback) => void;
  /** The one-line reason shown above the composer after a fallback. */
  fallbackNote?: string | null;
  /** A spoken turn was sent (so the session is saved as `voice`). */
  onVoiceTurn?: () => void;
}) {
  const seat = useRef<View>(null);
  const tick = useTickSwap();
  const layout = useListLayout();
  const fades = useFades();
  const p = scenario.persona;
  const avatar = scenarioAvatar(scenario);
  const first = callName(p.name);
  const { pending, error, request, cut, busy, clearError } = useEmployeeReply(scenario.id);
  const talk = mode === 'talk';
  const muted = useLearner((s) => s.settings.voiceMuted ?? false);
  const setSetting = useLearner((s) => s.setSetting);
  const mic = useRef<View>(null);
  const voice = useVoiceTurn({
    scenarioId: scenario.id,
    enabled: talk,
    muted,
    onTranscript: (text) => {
      // the bubble launches out of the mic, centre to centre
      let sent = false;
      const go = () => {
        if (sent) return;
        sent = true;
        onVoiceTurn?.();
        sendTurn(text, true);
      };
      const node = mic.current;
      if (!node) return go();
      node.measureInWindow((x, y, width, height) => {
        if (width > 0) setLaunchPad({ x, y, width, height, from: 'center' });
        go();
      });
      setTimeout(go, 40);
    },
    onFallback: (why) => onFallback?.(why),
  });
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<'end' | 'leave' | null>(null);
  const [goalOpen, setGoalOpen] = useState(true);
  const [unseen, setUnseen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  // replies that streamed in are already on screen; don't re-enter them when they settle
  const streamed = useRef(new Set<string>());
  // the move markers on your bubbles; any already read when this mounts pop in turn, quietly
  const lastPop = useRef(-Infinity);
  const [stamps, setStamps] = useState<Record<string, Stamp>>(() => {
    const tiers = liveMoments(moveLines(turns));
    const read = turns.filter((t) => t.speaker === 'learner' && t.move && tiers[t.id]);
    const at = staggerTimes(read.map(() => Date.now()));
    lastPop.current = at[at.length - 1] ?? -Infinity;
    return Object.fromEntries(read.map((t, i) => [t.id, stampFor(t.move!, tiers[t.id], at[i], true)]));
  });
  const [pulse, setPulse] = useState(0);
  // the stance each reply was played in, by your line, as its header said; kept if the reply is cut off unsaid
  const drewRef = useRef<Record<string, Stance | undefined>>({});
  const popped = useRef(new Set(Object.keys(stamps)));

  const learnerCount = turns.filter((t) => t.speaker === 'learner').length;
  // only exchanges they answered (a line that failed to send hasn't been heard), counting a
  // reply on screen now, since ending keeps it
  const answered = answeredExchanges(pending && !pending.typing && pending.text ? [...turns, { id: pending.id, speaker: 'employee', text: pending.text }] : turns);
  const ready = answered >= MIN_TURNS;
  const status = pending?.typing && voice.state !== 'speaking' ? 'typing…' : talk && voice.state === 'speaking' ? 'talking…' : learnerCount ? `${learnerCount} ${learnerCount === 1 ? 'reply' : 'replies'} from you` : p.role;
  // one list, so the pending reply and the turn it settles into are the same element (dots morph into words)
  const rows: Row[] = turns.map((t) => ({ id: t.id, speaker: t.speaker, text: t.text, live: false, typing: false }));
  if (pending) rows.push({ id: pending.id, speaker: 'employee', text: pending.text, live: true, typing: pending.typing || !pending.text });

  // how they're carrying themselves: the line being said now, else the last one (while they think, they hold)
  const lastSaid = [...turns].reverse().find((t) => t.speaker === 'employee');
  const speaking = pending && !pending.typing && pending.text ? pending : null;
  const stance: Stance | undefined = speaking ? speaking.stance : lastSaid?.stance;
  const line = speaking ? speaking.id : lastSaid?.id;
  const warmth = useWarmth(stance);
  // the first time they open up in this conversation (not the opening line): a light haptic and a spark
  const opened = stance === 'change' && line !== turns[0]?.id;

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    // after a failed reply, a new line goes out with the unanswered one (both stay in the thread)
    sendTurn(text, false);
    setDraft('');
  };

  /** Typed or spoken, a reply takes the same path: the turn, analytics, the employee's answer. */
  const sendTurn = (text: string, spoken: boolean) => {
    let base = turnsRef.current;
    if (spoken && pending) {
      // they cut in while the reply was still arriving: keep what had been said
      const how = pending.stance;
      const partial = pending.typing ? (cut(), '') : cut();
      if (partial) {
        streamed.current.add(`t${base.length}`);
        base = [...base, withStance({ id: `t${base.length}`, speaker: 'employee', text: partial }, how)];
      }
    }
    const said = base.filter((t) => t.speaker === 'learner').length;
    const next: Turn[] = [...base, { id: `t${base.length}`, speaker: 'learner', text }];
    track('roleplay_turn_sent', { scenario_id: scenario.id, turn_index: said }); // a count, never the text
    turnsRef.current = next;
    onTurns(next);
    atBottom.current = true;
    if (goalOpen && said === 0) setGoalOpen(false);
    ask(next);
  };

  /** The role-player's read of your line is back (before its words): pin the move to your bubble. */
  const onRead = (learnerId: string, { move, stance: drew }: ReplyRead) => {
    // a resend: the marker already popped, and the line keeps the read it popped with
    if (!move || popped.current.has(learnerId)) return;
    drewRef.current[learnerId] = drew;
    const now = turnsRef.current;
    const nextTurns = now.map((t) => (t.id === learnerId && t.speaker === 'learner' ? { ...t, move } : t));
    turnsRef.current = nextTurns;
    onTurns(nextTurns);
    const tier = liveMoments(moveLines(nextTurns, drewRef.current))[learnerId];
    if (!tier) return;
    popped.current.add(learnerId);
    const [at] = staggerTimes([Date.now()], lastPop.current);
    lastPop.current = at;
    setStamps((s) => ({ ...s, [learnerId]: stampFor(move, tier, at) }));
  };

  const ask = (history: Turn[]) => {
    const learnerId = history[history.length - 1]?.id;
    request(
      history,
      `t${history.length}`,
      (reply, said) => {
        if (!reply) return;
        const now = turnsRef.current;
        streamed.current.add(`t${now.length}`);
        const nextTurns: Turn[] = [...now, withStance({ id: `t${now.length}`, speaker: 'employee', text: reply }, said)];
        turnsRef.current = nextTurns;
        onTurns(nextTurns);
      },
      // Talk mode: the same stream is spoken, sentence by sentence
      talk ? voice.beginReply() : undefined,
      (read) => learnerId && onRead(learnerId, read),
    );
  };

  const end = () => {
    voice.stopSpeaking();
    // keep whatever has been said so far, including a reply mid-sentence
    const said = pending?.stance;
    const partial = pending && !pending.typing ? cut() : (cut(), '');
    const final = partial ? [...turns, withStance({ id: `t${turns.length}`, speaker: 'employee', text: partial }, said)] : turns;
    // the debrief needs the learner to have spoken at least once
    if (!final.some((t) => t.speaker === 'learner')) return onLeave();
    track('roleplay_ended', { scenario_id: scenario.id, learner_turns: final.filter((t) => t.speaker === 'learner').length, ended_early: !ready });
    onEnd(final);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const near = contentOffset.y + layoutMeasurement.height >= contentSize.height - 56;
    atBottom.current = near;
    if (near && unseen) setUnseen(false);
  };

  const onContent = () => {
    if (atBottom.current) scroll.current?.scrollToEnd({ animated: true });
    else setUnseen(true);
  };

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={() => (learnerCount ? setConfirm('leave') : onLeave())}
        closeLabel="Leave conversation"
        center={
          <View style={styles.who}>
            <View ref={seat} collapsable={false} onLayout={() => onSeat?.(seat.current)} style={seatHidden ? styles.hidden : undefined}>
              <SpeakingRing active={talk && voice.state === 'speaking'} level={voice.speakLevel} size={36}>
                <PersonaPresence stance={stance} line={line} warmth={warmth} size={36} spark={opened} pulse={pulse}>
                  <Avatar {...avatar} size={36} />
                </PersonaPresence>
              </SpeakingRing>
            </View>
            <View style={styles.whoCopy}>
              <Text variant="label" numberOfLines={1}>
                {p.name}
              </Text>
              {/* status ticks over (role → typing… → replies from you) instead of swapping in place */}
              <Animated.View key={status}>
                <Text variant="caption" color={color.muted} numberOfLines={1}>
                  {status}
                </Text>
              </Animated.View>
            </View>
          </View>
        }
        trailing={
          <View style={styles.trail}>
            {talk ? <MuteToggle muted={muted} onToggle={() => setSetting('voiceMuted', !muted)} /> : null}
            <EndButton ready={ready} disabled={learnerCount === 0} onPress={() => (ready ? end() : setConfirm('end'))} />
          </View>
        }
        footer={<WarmthThread warmth={warmth} stance={stance} />}
      />
      <GoalReminder goal={scenario.learnerGoal} open={goalOpen} onToggle={() => setGoalOpen((v) => !v)} />

      <KeyboardColumn>
        <View style={styles.flex}>
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={[sessionStyles.scroll, styles.thread]}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onContentSizeChange={onContent}
            // web: the keyboard shrinks the thread from below; keep the latest line in view
            onLayout={Platform.OS === 'web' ? () => atBottom.current && scroll.current?.scrollToEnd({ animated: false }) : undefined}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={sessionStyles.column}>
              <Text variant="caption" color={color.muted} align="center" style={styles.stamp}>
                {conversationLabel(scenarioFrame(scenario))} with {first}
              </Text>
              {rows.map((r, i) => (
                <Message
                  key={r.id}
                  row={r}
                  stamp={stamps[r.id]}
                  onStrong={() => setPulse((n) => n + 1)}
                  avatar={avatar}
                  name={p.name}
                  delay={i === 0 ? (arriving ? 400 : 250) : r.live ? 120 : 0}
                  settled={!r.live && streamed.current.has(r.id)}
                />
              ))}
              {error ? (
                <Animated.View entering={fades.entering} exiting={fades.exiting} layout={layout} style={styles.retry}>
                  <Text variant="caption" color={color.muted} align="center">
                    {failedTurnLine(error, first)}
                  </Text>
                  <SaveProgressLink error={error} style={styles.center} />
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Resend"
                    icon={<ArrowCounterClockwiseIcon size={16} weight="bold" color={color.primary} />}
                    iconPosition="leading"
                    onPress={() => {
                      // a second tap (or a tap while it fades out) would send the same line twice
                      if (busy()) return;
                      clearError();
                      ask(turnsRef.current);
                    }}
                    style={styles.center}
                  />
                </Animated.View>
              ) : null}
              {ready && !pending ? (
                <Animated.View entering={fades.entering} exiting={fades.exiting} layout={layout}>
                  <Text variant="caption" color={color.muted} align="center" style={styles.readyHint}>
                    End whenever you’re ready.
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          </ScrollView>
          {unseen ? (
            <NewReplyPill
              onPress={() => {
                atBottom.current = true;
                setUnseen(false);
                scroll.current?.scrollToEnd({ animated: true });
              }}
            />
          ) : null}
        </View>
        <Dock>
          {talk ? (
            <TalkDock voice={voice} name={first} micRef={mic} disabled={!!error} onType={() => onMode?.('type')} />
          ) : (
            <>
              {fallbackNote ? (
                <Animated.View entering={fades.entering} style={styles.fallback}>
                  <MicrophoneSlashIcon size={16} weight="bold" color={color.muted} />
                  <Text variant="caption" color={color.muted} style={styles.flex}>
                    {fallbackNote}
                  </Text>
                </Animated.View>
              ) : null}
              <Composer
                value={draft}
                onChangeText={setDraft}
                onSend={send}
                busy={!!pending}
                placeholder={`Reply to ${first}…`}
                accessibilityLabel={`Your reply to ${p.name}`}
              />
            </>
          )}
        </Dock>
      </KeyboardColumn>

      <ConfirmSheet
        open={confirm === 'end'}
        onClose={() => setConfirm(null)}
        title="End the conversation?"
        body={endSheetBody(answered, first)}
        stay="Keep talking"
        leave="End and reflect"
        onLeave={() => {
          setConfirm(null);
          setTimeout(end, 200);
        }}
      />
      <ConfirmSheet
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title="Leave this conversation?"
        body="It won’t be saved, and there’s no debrief. To get feedback, end the conversation instead."
        stay="Keep talking"
        leave="Leave"
        onLeave={() => {
          setConfirm(null);
          cut();
          voice.stopSpeaking();
          setTimeout(onLeave, 200);
        }}
      />
    </View>
  );
}

type Row = { id: string; speaker: Turn['speaker']; text: string; live: boolean; typing: boolean };

/** A counterpart line, with the stance it was played in when the API said. */
function withStance(turn: Turn, stance?: Stance): Turn {
  return stance ? { ...turn, stance } : turn;
}

/**
 * One line of the thread. Yours launches out of the composer; theirs rises from
 * their side as typing dots and stays the same element while the words arrive.
 * Rows carry a layout spring so anything that changes size above them moves them, not snaps them.
 */
function Message({
  row,
  avatar,
  name,
  delay,
  settled,
  stamp,
  onStrong,
}: {
  row: Row;
  avatar: AvatarIdentity;
  name: string;
  delay: number;
  settled: boolean;
  stamp?: Stamp;
  onStrong: () => void;
}) {
  const layout = useListLayout();
  if (row.speaker === 'learner') return <LearnerMessage text={row.text} layout={layout} stamp={stamp} onStrong={onStrong} />;
  return <EmployeeMessage row={row} avatar={avatar} name={name} delay={delay} settled={settled} layout={layout} />;
}

/** Yours, with its move marker once the reply comes back. The row grows a little to make room; rows below spring down. */
function LearnerMessage({ text, layout, stamp, onStrong }: { text: string; layout: ReturnType<typeof useListLayout>; stamp?: Stamp; onStrong: () => void }) {
  const launch = useComposerLaunch();
  const [shine, setShine] = useState(false);
  const onPeak = (tier: MoveTier) => {
    setShine(true);
    if (tier === 'strong') onStrong();
  };
  return (
    <Animated.View
      ref={launch.ref}
      onLayout={launch.onLayout}
      collapsable={false}
      layout={layout}
      style={[styles.msg, stamp && styles.stamped, launch.style]}
    >
      <LearnerBubble
        text={text}
        accessory={
          stamp ? (
            <>
              <BubbleSheen play={shine} />
              <MoveStamp stamp={stamp} onPeak={onPeak} />
            </>
          ) : null
        }
      />
    </Animated.View>
  );
}

/** A move marker: the move's own shape, or the neutral dot for a weak move (never a negative one). */
function stampFor(move: NonNullable<Turn['move']>, tier: MoveTier, at: number, quiet?: boolean): Stamp {
  return { family: tier === 'weak' ? 'neutral' : MOVE[move].family, tier, at, quiet };
}

function EmployeeMessage({
  row,
  avatar,
  name,
  delay,
  settled,
  layout,
}: {
  row: Row;
  avatar: AvatarIdentity;
  name: string;
  delay: number;
  settled: boolean;
  layout: ReturnType<typeof useListLayout>;
}) {
  const enter = useBubbleEntrance('left', delay, settled);
  // replies that streamed in keep their live bubble; history and the opening line render statically
  const [wasLive] = useState(row.live);
  return (
    <Animated.View layout={layout} style={[styles.msg, enter]} accessibilityLiveRegion={row.live ? 'polite' : undefined}>
      {wasLive ? <LiveEmployeeBubble avatar={avatar} name={name} text={row.text} typing={row.typing} /> : <EmployeeBubble text={row.text} avatar={avatar} name={name} />}
    </Animated.View>
  );
}

/** End sits quiet until there's enough to debrief, then wakes up cobalt with a pop. */
function EndButton({ ready, disabled, onPress }: { ready: boolean; disabled: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  const was = useRef(ready);
  useEffect(() => {
    if (ready && !was.current) {
      haptic.tick();
      if (!reduce) s.value = withSequence(withSpring(1.16, spring.snappy), withSpring(1, spring.bouncy));
    }
    was.current = ready;
  }, [ready, reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={style}>
      <PressableSurface
        tone={ready ? 'primary' : 'surface'}
        depth={3}
        radius={radius.sm}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={ready ? 'End conversation' : 'End conversation early'}
        hitSlop={4}
        contentStyle={styles.endFace}
      >
        <Text variant="label" color={disabled ? color.faint : ready ? color.white : color.primary}>
          End
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

/** "Your goal": open at the start, folds away after the first reply, a tap brings it back. */
function GoalReminder({ goal, open, onToggle }: { goal: string; open: boolean; onToggle: () => void }) {
  const reduce = useReduceMotion();
  const [h, setH] = useState(0);
  const v = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    v.value = reduce ? withTiming(open ? 1 : 0, { duration: FADE_MS }) : withSpring(open ? 1 : 0, spring.settle);
  }, [open, reduce, v]);
  const body = useAnimatedStyle(() => ({ height: h * v.value, opacity: v.value }));
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * v.value}deg` }] }));
  return (
    <View style={styles.goalWrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? `Your goal: ${goal}. Hide` : 'Show your goal'}
        style={styles.goal}
      >
        <View style={styles.goalHead}>
          <TargetIcon size={16} weight="bold" color={color.primary} />
          <Text variant="label" color={color.primaryShadow} style={styles.flex}>
            Your goal
          </Text>
          <Animated.View style={caret}>
            <CaretDownIcon size={16} weight="bold" color={color.primary} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.goalBody, body]}>
          <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={styles.goalMeasure}>
            <Text variant="body" color={color.ink} style={styles.goalText}>
              {goal}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function NewReplyPill({ onPress }: { onPress: () => void }) {
  const enter = useBubbleEntrance('left');
  return (
    <Animated.View style={[styles.pillWrap, enter]} pointerEvents="box-none">
      <PressableSurface tone="primary" depth={3} radius={radius.pill} onPress={onPress} accessibilityLabel="Jump to the new reply" contentStyle={styles.pill}>
        <CaretDownIcon size={14} weight="bold" color={color.white} />
        <Text variant="label" color={color.white}>
          New reply
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { opacity: 0 },
  trail: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  fallback: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  center: { alignSelf: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space[2], maxWidth: 230 },
  whoCopy: { flexShrink: 1 },
  thread: { paddingTop: space[3], paddingBottom: space[5] },
  stamp: { marginBottom: space[4] },
  msg: { marginBottom: space[3] },
  // room for the marker hanging off the bubble's corner; above the row below, so a burst isn't covered
  stamped: { marginBottom: space[3] + 8, zIndex: 1 },
  retry: { gap: space[2], marginTop: space[2] },
  readyHint: { marginTop: space[2] },
  // flexGrow 0: the raised face must not stretch to the header's height
  endFace: { flexGrow: 0, minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  goalWrap: { paddingHorizontal: layout.gutter, paddingBottom: space[2], width: '100%', maxWidth: layout.maxWidth + 40, alignSelf: 'center' },
  goal: { backgroundColor: color.soft, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[3] },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 20 },
  goalBody: { overflow: 'hidden' },
  goalMeasure: { position: 'absolute', left: 0, right: 0, top: 0 },
  goalText: { paddingTop: space[2], fontSize: 15, lineHeight: 21 },
  pillWrap: { position: 'absolute', bottom: space[3], alignSelf: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 36 },
});
