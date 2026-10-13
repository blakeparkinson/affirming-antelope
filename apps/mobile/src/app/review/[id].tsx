import { getScenario } from '@antelope/core';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlowHeader, flowStyles } from '@/components/account/FlowChrome';
import { Mascot } from '@/components/mascot';
import { ConfirmSheet } from '@/components/practice-loop/ConfirmSheet';
import { Dock } from '@/components/practice-loop/SessionChrome';
import { VoiceNote } from '@/components/review/VoiceNote';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  Avatar,
  Bubble,
  Button,
  Callout,
  Chip,
  HourglassIcon,
  QuotesIcon,
  Raised,
  Text,
  color,
  haptic,
  space,
} from '@/design';
import { callName } from '@/components/practice-loop/names';
import { openPractice, practiceKindLabel, practiceMinutes, practiceTitle, sessionLabel, shortDate } from '@/data/practice';
import { track } from '@/lib/analytics';
import { Enter, FADE_MS, STAGGER, spring, useReduceMotion } from '@/motion';
import { reviewAudioUrl } from '@/sync/cloud';
import { markReviewSeen, submitForReview, syncNow, withdrawSubmission } from '@/sync/engine';
import { useLearner } from '@/state/store';
import { RATING, firstNameOf, personSeed, useAccount, type Review, type Submission } from '@/state/account';

/**
 * One submission, from the learner's side: waiting for review (with withdraw),
 * withdrawn, or the trainer's feedback. Opening a review marks it seen.
 */
export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const sub = useAccount((s) => s.submissions.find((x) => x.id === id));
  const review = useAccount((s) => s.reviews.find((r) => r.submissionId === id));
  const cohort = useAccount((s) => s.cohorts.find((c) => c.id === sub?.cohortId));
  const [refreshing, setRefreshing] = useState(false);
  // a queued share can turn out to be a duplicate (the session was already shared from another
  // device); the outbox then swaps it for the server's row, and this screen follows it
  const lastSession = useRef<string | null>(null);
  if (sub) lastSession.current = sub.sessionId;
  const replacement = useAccount((s) =>
    !sub && lastSession.current ? s.submissions.find((x) => x.sessionId === lastSession.current && x.status !== 'withdrawn') : undefined,
  );
  useEffect(() => {
    if (replacement) router.replace({ pathname: '/review/[id]', params: { id: replacement.id } });
  }, [replacement]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (review && !review.learnerSeenAt) markReviewSeen(review.id);
  }, [review]);

  // once per review opened: a rating level and two flags, never the feedback text or the clip
  const reviewId = review?.id;
  useEffect(() => {
    if (!review) return;
    track('review_viewed', { ...(review.rating ? { rating: review.rating } : {}), has_audio: !!review.audioPath, try_again: review.tryAgain });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]);

  const trainerName = review?.trainerName ?? cohort?.trainerName ?? 'Your trainer';
  const primary = review ? primaryAction(review, sub) : null;

  return (
    <View style={flowStyles.root}>
      <FlowHeader
        topInset={insets.top}
        onBack={() => router.back()}
        center={<Text variant="subheading">{review ? 'Trainer feedback' : sub?.status === 'withdrawn' ? 'Withdrawn' : 'Shared for review'}</Text>}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} />}
      >
        <View style={flowStyles.body}>
          {!sub ? (
            <Enter style={styles.missing}>
              <Text variant="heading">That one isn’t here anymore.</Text>
              <Text variant="body" color={color.muted}>
                Pull down to refresh, or head back to Home.
              </Text>
            </Enter>
          ) : review ? (
            <Feedback review={review} sub={sub} />
          ) : sub.status === 'withdrawn' ? (
            <Withdrawn sub={sub} trainerName={trainerName} />
          ) : (
            <Waiting sub={sub} trainerName={trainerName} />
          )}
        </View>
      </ScrollView>
      {primary ? (
        <Enter index={6}>
          <Dock>
            <Button label={primary.label} fullWidth onPress={primary.run} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
          </Dock>
        </Enter>
      ) : null}
    </View>
  );
}

/** One primary action: the trainer's recommended practice, else a fresh run at the same scenario. */
function primaryAction(review: Review, sub: Submission | undefined): { label: string; run: () => void } | null {
  if (review.recommendedKind && review.recommendedRef) {
    const kind = review.recommendedKind;
    const ref = review.recommendedRef;
    return { label: 'Start', run: () => openPractice(kind, ref, 'review') };
  }
  if (sub?.kind === 'roleplay' && sub.refId)
    return {
      label: 'Try again',
      run: () => openPractice('roleplay', sub.refId, 'review'),
    };
  return null;
}

/**
 * "role-play with Josh" / "role-play with Ms. Alvarez": what a trainer's note is about,
 * named by the person in it (their scenario id means nothing to the learner).
 */
function sessionWhat(sub: Submission): string {
  const scenario = sub.kind === 'roleplay' ? getScenario(sub.refId) : undefined;
  return scenario ? `role-play with ${callName(scenario.persona.name)}` : sessionLabel(sub.kind, sub.refId);
}

function Feedback({ review, sub }: { review: Review; sub: Submission }) {
  const first = firstNameOf(review.trainerName) ?? 'Your trainer';
  const [audio, setAudio] = useState<{ url: string | null; error: boolean }>({
    url: null,
    error: false,
  });
  const loadAudio = useCallback(async () => {
    if (!review.audioPath) return;
    setAudio({ url: null, error: false });
    const url = await reviewAudioUrl(review.audioPath);
    setAudio({ url, error: !url });
  }, [review.audioPath]);
  useEffect(() => {
    void loadAudio();
  }, [loadAudio]);

  const recommended = review.recommendedKind && review.recommendedRef ? { kind: review.recommendedKind, ref: review.recommendedRef } : null;
  const canRetry = sub.kind === 'roleplay' && !!sub.refId;

  return (
    <View>
      <Enter style={styles.who}>
        <Avatar seed={personSeed(review.trainerName)} size={56} accessibilityLabel={review.trainerName} />
        <View style={styles.flex}>
          <Text variant="heading" accessibilityRole="header">
            {review.trainerName}
          </Text>
          <Text variant="caption" color={color.muted}>
            On your {sessionWhat(sub)}: {practiceTitle(sub.kind, sub.refId)} · {shortDate(review.createdAt)}
          </Text>
        </View>
      </Enter>

      {review.rating ? (
        <Enter index={1} style={styles.block}>
          <Rating level={review.rating} first={first} />
        </Enter>
      ) : null}

      {review.feedback.trim() ? (
        <Enter index={2} style={styles.block}>
          <Bubble side="coach">
            <View style={styles.quoteHead}>
              <QuotesIcon size={18} weight="fill" color={color.primaryTint} />
              <Text variant="overline" color={color.primaryShadow}>
                {first}’s notes
              </Text>
            </View>
            <Text variant="body" selectable>
              {review.feedback.trim()}
            </Text>
          </Bubble>
        </Enter>
      ) : null}

      {review.audioPath ? (
        <Enter index={3} style={styles.block}>
          <VoiceNote url={audio.url} error={audio.error} onRetry={loadAudio} seed={review.audioPath} trainerFirst={first} />
        </Enter>
      ) : null}

      {recommended ? (
        <Enter index={4} style={styles.block}>
          <Raised contentStyle={styles.rec}>
            <Text variant="overline" color={color.primaryShadow}>
              {first} recommends
            </Text>
            <Text variant="subheading">{practiceTitle(recommended.kind, recommended.ref)}</Text>
            <Text variant="caption" color={color.muted}>
              {practiceKindLabel(recommended.kind)} · {practiceMinutes(recommended.kind)}
            </Text>
          </Raised>
        </Enter>
      ) : null}

      {canRetry ? (
        <Enter index={5} style={styles.block}>
          {review.tryAgain ? (
            <Callout dense style={styles.tryNote}>
              <Text variant="bodySmall">{first} suggests a fresh run at this one.</Text>
            </Callout>
          ) : null}
          {recommended ? (
            <Button
              variant="secondary"
              label="Try this one again"
              fullWidth
              icon={<ArrowCounterClockwiseIcon size={20} weight="bold" color={color.primary} />}
              iconPosition="leading"
              onPress={() => openPractice('roleplay', sub.refId, 'review')}
            />
          ) : null}
        </Enter>
      ) : null}

      <Enter index={6} style={styles.block}>
        <Sent sub={sub} />
      </Enter>
    </View>
  );
}

/**
 * The qualitative level, as words. The word pops in on a bouncy spring with a tick,
 * and the line under it says what the level means. Never a number, never a bar.
 */
function Rating({ level, first }: { level: keyof typeof RATING; first: string }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      pop.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    pop.value = withDelay(STAGGER * 3, withSequence(withSpring(1.08, spring.snappy), withSpring(1, spring.bouncy)));
    const t = setTimeout(() => haptic.tick(), STAGGER * 3 + 60);
    return () => clearTimeout(t);
  }, [reduce, pop]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.6),
    transform: reduce ? [] : [{ scale: 0.85 + 0.15 * pop.value }],
  }));
  const r = RATING[level];
  return (
    <Callout overline={`${first}’s read on this session`}>
      <Animated.View style={[styles.ratingWord, style]}>
        <Text variant="title" color={color.primaryShadow}>
          {r.label}
        </Text>
      </Animated.View>
      <Text variant="bodySmall" color={color.ink}>
        {r.detail}
      </Text>
    </Callout>
  );
}

function Sent({ sub }: { sub: Submission }) {
  return (
    <View style={styles.sent}>
      <Text variant="overline" color={color.muted}>
        What you shared
      </Text>
      <Text variant="bodySmall" color={color.ink}>
        {practiceTitle(sub.kind, sub.refId)}, shared {shortDate(sub.submittedAt)}. The transcript, the coach’s feedback and your reflection.
      </Text>
      {sub.note ? (
        <Text variant="bodySmall" color={color.muted} style={styles.note}>
          Your note: “{sub.note}”
        </Text>
      ) : null}
    </View>
  );
}

function Waiting({ sub, trainerName }: { sub: Submission; trainerName: string }) {
  const focused = useIsFocused();
  const [confirm, setConfirm] = useState(false);
  const first = firstNameOf(trainerName) ?? 'Your trainer';
  return (
    <View>
      <Enter style={styles.waitHead}>
        <Mascot pose="head" mood="listening" size={84} paused={!focused} accessibilityLabel="The antelope coach" />
      </Enter>
      <Enter index={1}>
        <View style={styles.chipRow}>
          <Chip
            label={sub.local ? 'Waiting to send' : 'Awaiting review'}
            tone="soft"
            icon={<HourglassIcon size={14} weight="bold" color={color.primaryShadow} />}
          />
        </View>
        <Text variant="title" accessibilityRole="header" style={styles.waitTitle}>
          With {trainerName}
        </Text>
        <Text variant="body" color={color.muted} style={styles.lede}>
          {sub.local
            ? 'Saved on this phone. It sends as soon as you’re back online.'
            : `${first} will review it before your next group session. The feedback shows up here and on Home.`}
        </Text>
      </Enter>
      <Enter index={2} style={styles.block}>
        <Sent sub={sub} />
      </Enter>
      <Enter index={3} style={styles.block}>
        <Button variant="secondary" label="Withdraw" fullWidth onPress={() => setConfirm(true)} />
        <Text variant="caption" color={color.muted} align="center" style={styles.withdrawNote}>
          You can take it back until {first} has reviewed it.
        </Text>
      </Enter>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Withdraw this session?"
        body={`${first} won’t see it. The practice stays yours and your progress doesn’t change.`}
        stay="Keep it shared"
        leave="Withdraw"
        onLeave={() => {
          setConfirm(false);
          withdrawSubmission(sub.id);
          haptic.press();
        }}
      />
    </View>
  );
}

/**
 * Withdrawn stays as history. The learner can share the same session again: that's
 * a new submission (new id), and this screen hands over to it.
 */
function Withdrawn({ sub, trainerName }: { sub: Submission; trainerName: string }) {
  const active = useAccount((s) => s.submissions.find((x) => x.sessionId === sub.sessionId && x.status !== 'withdrawn'));
  const cohorts = useAccount((s) => s.cohorts);
  const session = useLearner((s) => s.sessions.find((x) => x.id === sub.sessionId));
  const cohort = cohorts.find((c) => c.id === sub.cohortId) ?? cohorts[0];
  const open = (id: string) => router.replace({ pathname: '/review/[id]', params: { id } });
  const reshare = () => {
    if (!cohort) return;
    const next = submitForReview({ sessionId: sub.sessionId, kind: sub.kind, refId: sub.refId, session }, cohort.id, sub.note ?? '');
    if (next) {
      haptic.success();
      open(next.id);
    }
  };
  return (
    <View>
      <Enter style={styles.block}>
        <Chip label="Withdrawn" tone="neutral" />
        <Text variant="title" accessibilityRole="header" style={styles.waitTitle}>
          Only you can see this now
        </Text>
        <Text variant="body" color={color.muted} style={styles.lede}>
          You took this session back, so {trainerName} won’t review it.
        </Text>
      </Enter>
      <Enter index={1} style={styles.block}>
        <Sent sub={sub} />
      </Enter>
      <Enter index={2} style={styles.block}>
        {active ? (
          <Button variant="secondary" label="See where it is now" fullWidth onPress={() => open(active.id)} />
        ) : cohort ? (
          <Button variant="secondary" label={`Share it again with ${firstNameOf(cohort.trainerName) ?? cohort.trainerName}`} fullWidth onPress={reshare} />
        ) : (
          <Text variant="caption" color={color.muted}>
            Join your cohort to share it again.
          </Text>
        )}
      </Enter>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: space[2], paddingBottom: space[10] },
  flex: { flex: 1 },
  missing: { gap: space[2], paddingTop: space[8] },
  who: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  block: { marginTop: space[5] },
  quoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[2],
  },
  ratingWord: {
    alignSelf: 'flex-start',
    transformOrigin: 'left center',
    marginBottom: 2,
  },
  rec: { padding: space[4], gap: 2 },
  tryNote: { marginBottom: space[3] },
  sent: { gap: space[1] },
  note: { marginTop: space[1] },
  waitHead: {
    alignItems: 'flex-start',
    marginTop: space[2],
    marginBottom: space[3],
  },
  chipRow: { flexDirection: 'row' },
  waitTitle: { marginTop: space[3] },
  lede: { marginTop: space[2] },
  withdrawNote: { marginTop: space[2] },
});
