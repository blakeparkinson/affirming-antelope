import { getDrill, getScenario, scenarioFrame, type Frame } from '@antelope/core';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Avatar, BottomSheet, Button, CheckIcon, CloudArrowUpIcon, LockSimpleIcon, Text, TextLink, border, color, font, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { useKeyboardHeight } from '@/components/practice-loop/useKeyboardHeight';
import { isSimulatedOffline } from '@/lib/supabase';
import { submitForReview, withdrawSubmission } from '@/sync/engine';
import { firstNameOf, personSeed, useAccount, type Cohort, type Submission } from '@/state/account';
import type { PracticeSession } from '@/state/store';

export type ReviewGate = 'sign-in' | 'join';

/** The note's example, in the words of the conversation the learner just had. */
const NOTE_PLACEHOLDER: Record<Frame, string> = {
  clinical: 'e.g. “I got stuck after she mentioned the cost.”',
  workplace: 'e.g. “I got stuck after he mentioned the template.”',
  sports: 'e.g. “I got stuck after he blamed his teammates.”',
};

/**
 * Opt-in trainer review for this one session. Says exactly what's shared and what
 * isn't, takes an optional note, then confirms with a check pop.
 *
 * What it asks for depends on the account:
 *   guest            sign in first (the session is saved on the phone meanwhile)
 *   no cohort        join your cohort first
 *   one cohort       straight to the note and SEND
 *   several cohorts  pick which trainer gets it
 *   already shared   its real state: on its way, with the trainer, or reviewed
 * Sign-in and join are full screens, so the sheet hands off (`onGate`) and the
 * debrief reopens it when the learner comes back.
 */
export function ReviewSheet({
  open,
  onClose,
  session,
  turnCount,
  feeling,
  onGate,
}: {
  open: boolean;
  onClose: () => void;
  session: PracticeSession | null;
  turnCount: number;
  feeling: string;
  onGate: (g: ReviewGate) => void;
}) {
  const status = useAccount((s) => s.status);
  const cohorts = useAccount((s) => s.cohorts);
  const sub = useAccount((s) => (session ? s.submissions.find((x) => x.sessionId === session.id && x.status !== 'withdrawn') : undefined));
  const review = useAccount((s) => (sub ? s.reviews.find((r) => r.submissionId === sub.id) : undefined));
  const [note, setNote] = useState('');
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const kb = useKeyboardHeight();

  useEffect(() => {
    if (!cohortId && cohorts.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const target = cohorts.find((c) => c.id === cohortId) ?? cohorts[0];
  // the cohort's trainer, else a neutral phrase (a guest or an unjoined learner has no trainer to name)
  const trainerName = target?.trainerName ?? 'your trainer';
  const first = firstNameOf(target?.trainerName) ?? 'your trainer';
  const scenario = session && session.kind !== 'drill' ? getScenario(session.refId) : undefined;
  const frame: Frame = (session?.kind === 'drill' ? getDrill(session.refId)?.setting : scenario ? scenarioFrame(scenario) : undefined) ?? 'workplace';

  const send = () => {
    if (!session || !target) return;
    submitForReview({ sessionId: session.id, kind: session.kind, refId: session.refId, session }, target.id, note.trim());
    setJustSent(true);
    haptic.success();
  };

  let body;
  if (sub) {
    body = (
      <Sent
        sub={sub}
        trainerName={cohorts.find((c) => c.id === sub.cohortId)?.trainerName}
        reviewedBy={review?.trainerName}
        pop={justSent}
        onDone={onClose}
        onWithdraw={
          sub.status === 'submitted'
            ? () => {
                withdrawSubmission(sub.id);
                setJustSent(false);
              }
            : undefined
        }
      />
    );
  } else if (status !== 'signed-in') {
    body = (
      <Gate
        title="Trainer review needs an account"
        lede="Sign in and join your cohort, then send this session in one go. It’s saved on your phone in the meantime."
        cta="Sign in to send"
        onCta={() => onGate('sign-in')}
        onClose={onClose}
        turnCount={turnCount}
        feeling={feeling}
      />
    );
  } else if (!cohorts.length) {
    body = (
      <Gate
        title="Join your cohort first"
        lede="Your trainer’s code connects you. Then this session goes straight to them."
        cta="Join cohort"
        onCta={() => onGate('join')}
        onClose={onClose}
        turnCount={turnCount}
        feeling={feeling}
      />
    );
  } else {
    body = (
      <View>
        <View style={styles.head}>
          <Avatar seed={personSeed(trainerName)} size={48} accessibilityLabel={trainerName} />
          <View style={styles.flex}>
            <Text variant="heading" accessibilityRole="header">
              Share this session with {trainerName}?
            </Text>
          </View>
        </View>
        <Text variant="body" color={color.muted} style={styles.lede}>
          Only this conversation. {first} will review it before your next group session.
        </Text>

        {cohorts.length > 1 && kb === 0 ? <CohortPicker cohorts={cohorts} value={target?.id ?? null} onChange={setCohortId} /> : null}

        {/* while typing the note the keyboard needs the room; the list was just read */}
        <View style={[styles.list, kb > 0 && styles.hidden]}>
          <Shared turnCount={turnCount} feeling={feeling} />
        </View>

        <Text variant="label" style={styles.noteLabel}>
          Note to {first} (optional)
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={NOTE_PLACEHOLDER[frame]}
          placeholderTextColor={color.faint}
          multiline
          maxLength={2000}
          maxFontSizeMultiplier={1.4}
          style={styles.note}
          accessibilityLabel={`Note to ${trainerName}, optional`}
        />

        <View style={styles.actions}>
          <Button label="Send for review" fullWidth disabled={!session} onPress={send} />
          {kb > 0 ? null : <Button variant="secondary" label="Not now" fullWidth onPress={onClose} />}
        </View>
        <View style={{ height: kb }} />
      </View>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight={0.94} accessibilityLabel="Submit for trainer review">
      {body}
    </BottomSheet>
  );
}

function Shared({ turnCount, feeling }: { turnCount: number; feeling: string }) {
  return (
    <>
      <Text variant="overline" color={color.primaryShadow}>
        What’s shared
      </Text>
      <Row text={`The full transcript (${turnCount} turns)`} />
      <Row text="The coach feedback you just read" />
      <Row text={`Your reflection (“${feeling}”) and anything you wrote`} />
      <View style={styles.notShared}>
        <LockSimpleIcon size={16} weight="bold" color={color.muted} />
        <Text variant="caption" color={color.muted} style={styles.flex}>
          Not shared: your other practice, streak, or skill levels.
        </Text>
      </View>
    </>
  );
}

function Gate({
  title,
  lede,
  cta,
  onCta,
  onClose,
  turnCount,
  feeling,
  trainerName,
}: {
  title: string;
  lede: string;
  cta: string;
  onCta: () => void;
  onClose: () => void;
  turnCount: number;
  feeling: string;
  trainerName?: string;
}) {
  return (
    <View>
      <View style={styles.head}>
        {trainerName ? <Avatar seed={personSeed(trainerName)} size={48} accessibilityLabel={trainerName} /> : null}
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
        </View>
      </View>
      <Text variant="body" color={color.muted} style={styles.lede}>
        {lede}
      </Text>
      <View style={styles.list}>
        <Shared turnCount={turnCount} feeling={feeling} />
      </View>
      <View style={styles.actions}>
        <Button label={cta} fullWidth onPress={onCta} />
        <Button variant="secondary" label="Not now" fullWidth onPress={onClose} />
      </View>
    </View>
  );
}

/** Which trainer gets it, when the learner is in more than one cohort. */
function CohortPicker({ cohorts, value, onChange }: { cohorts: Cohort[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={styles.picker} accessibilityRole="radiogroup">
      <Text variant="overline" color={color.primaryShadow}>
        Send to
      </Text>
      {cohorts.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              if (!on) haptic.tick();
              onChange(c.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${c.trainerName}, ${c.name}`}
            style={[styles.option, on && styles.optionOn]}
          >
            <Avatar seed={personSeed(c.trainerName)} size={36} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{c.trainerName}</Text>
              <Text variant="caption" color={color.muted} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <CheckIcon size={12} weight="bold" color={color.white} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.tick}>
        <CheckIcon size={12} weight="bold" color={color.white} />
      </View>
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

function Sent({
  sub,
  trainerName,
  reviewedBy,
  pop,
  onDone,
  onWithdraw,
}: {
  sub: Submission;
  trainerName?: string;
  reviewedBy?: string;
  pop: boolean;
  onDone: () => void;
  onWithdraw?: () => void;
}) {
  const reduce = useReduceMotion();
  const s = useSharedValue(pop ? 0 : 1);
  useEffect(() => {
    if (!pop) return;
    s.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSequence(withSpring(1.2, spring.snappy), withSpring(1, spring.bouncy));
  }, [pop, reduce, s]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: Math.min(1, s.value * 2),
  }));
  const first = firstNameOf(trainerName) ?? 'Your trainer';
  const queued = sub.local && (useAccount.getState().offline || isSimulatedOffline());

  const title = reviewedBy ? `Reviewed by ${reviewedBy}` : queued ? 'Saved. It’ll send soon' : `Sent to ${trainerName ?? 'your trainer'}`;
  const detail = reviewedBy
    ? 'Find the feedback on Home and in Me, under From your trainer.'
    : queued
      ? 'You’re offline right now. It goes to your trainer as soon as you’re back.'
      : `${first} will review it before your next group session. The feedback shows up on Home.`;

  return (
    <View style={styles.sent} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.sentBadge, queued && styles.sentBadgeQueued, style]}>
        {queued ? <CloudArrowUpIcon size={32} weight="bold" color={color.primaryShadow} /> : <CheckIcon size={34} weight="bold" color={color.navy} />}
      </Animated.View>
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color={color.muted} align="center">
        {detail}
      </Text>
      <Button label="Done" fullWidth onPress={onDone} style={styles.sentBtn} />
      {onWithdraw ? <TextLink label="Withdraw" onPress={onWithdraw} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  lede: { marginTop: space[3] },
  list: { marginTop: space[5], gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notShared: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingLeft: 3,
  },
  picker: { marginTop: space[5], gap: space[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: border,
    borderColor: color.line,
  },
  optionOn: { borderColor: color.primary, backgroundColor: color.soft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: border,
    borderColor: color.shadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: color.primary, borderColor: color.primary },
  noteLabel: { marginTop: space[5], marginBottom: space[2] },
  note: {
    minHeight: 72,
    maxHeight: 120,
    borderWidth: border,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', resize: 'none' } as object) : null),
  },
  actions: { marginTop: space[5], gap: space[3] },
  sent: { alignItems: 'center', gap: space[3], paddingTop: space[2] },
  sentBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.gold,
    borderBottomWidth: 5,
    borderBottomColor: color.goldShadow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  sentBadgeQueued: {
    backgroundColor: color.soft,
    borderBottomColor: color.shadow,
  },
  sentBtn: { marginTop: space[4] },
});
