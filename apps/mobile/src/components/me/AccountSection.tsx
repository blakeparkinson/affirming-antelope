import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { TextField, Notice } from '@/components/account/FlowChrome';
import { ConfirmSheet } from '@/components/practice-loop/ConfirmSheet';
import { useKeyboardHeight } from '@/components/practice-loop/useKeyboardHeight';
import {
  Avatar,
  BottomSheet,
  Button,
  CaretRightIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  EnvelopeSimpleIcon,
  PencilSimpleIcon,
  Raised,
  SignOutIcon,
  Text,
  TextLink,
  UsersThreeIcon,
  color,
  haptic,
  radius,
  space,
} from '@/design';
import { usePressScale, useTickSwap } from '@/motion';
import { signOut } from '@/sync/auth';
import { leaveCohort, renameSelf } from '@/sync/cloud';
import { flushBeforeSignOut, startOverAsGuest, syncNow } from '@/sync/engine';
import { useOutbox } from '@/sync/outbox';
import { personSeed, useAccount, type Cohort } from '@/state/account';

/**
 * Me › Account. Guests get one card that says what signing in unlocks, and a way to start
 * over as a new guest (back to the welcome; nothing else returns there once onboarded). Signed in:
 * email, display name (rename in a sheet), cohorts (leave), sync status, sign out.
 */
export function AccountSection() {
  const status = useAccount((s) => s.status);
  if (status !== 'signed-in') return <GuestCard />;
  return <SignedIn />;
}

function GuestCard() {
  const [restart, setRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Raised contentStyle={styles.guest}>
        <Text variant="subheading">You’re practicing as a guest</Text>
        <Text variant="body" color={color.muted}>
          Everything stays on this phone. Sign in to join your cohort and share role-plays with your trainer. Your practice so far comes with you.
        </Text>
        <Button
          variant="secondary"
          size="md"
          label="Sign in"
          fullWidth
          onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'me' } })}
          style={styles.guestBtn}
        />
        <TextLink label="Start over as a new guest" onPress={() => setRestart(true)} style={styles.restart} />
      </Raised>
      <ConfirmSheet
        open={restart}
        onClose={() => setRestart(false)}
        title="Start over?"
        body="This clears your practice, streak and track on this device and takes you back to the welcome. It can’t be undone. To keep your practice, sign in instead."
        stay="Keep my practice"
        leave="Start over"
        busy={busy}
        onLeave={async () => {
          setBusy(true);
          // the welcome takes over as soon as the wipe lands (the root layout's onboarding guard)
          await startOverAsGuest();
        }}
      />
    </>
  );
}

function SignedIn() {
  const profile = useAccount((s) => s.profile);
  const cohorts = useAccount((s) => s.cohorts);
  const [rename, setRename] = useState(false);
  const [leaving, setLeaving] = useState<Cohort | null>(null);
  const [out, setOut] = useState(false);
  // 'ask': the normal confirm. 'saving': sending what's waiting. 'unsynced': some of it couldn't be sent.
  const [outStep, setOutStep] = useState<'ask' | 'saving' | 'unsynced'>('ask');

  const openSignOut = () => {
    setOutStep('ask');
    setOut(true);
  };
  const closeSignOut = () => {
    if (outStep === 'saving') return;
    setOut(false);
  };
  const unsynced = outStep === 'unsynced';
  // Wait: stay signed in and keep trying to send
  const waitForSync = () => {
    setOut(false);
    void syncNow();
  };
  const signOutAnyway = async () => {
    setOut(false);
    await signOut();
  };
  const confirmSignOut = async () => {
    setOutStep('saving');
    // send everything first: signing out wipes this device, so the server must have it
    if (await flushBeforeSignOut()) {
      setOut(false);
      await signOut();
    } else {
      setOutStep('unsynced');
    }
  };

  return (
    <>
      <Raised contentStyle={styles.list}>
        <Row icon={<EnvelopeSimpleIcon size={20} weight="bold" color={color.primary} />} title="Email" detail={profile?.email ?? ''} />
        <Row
          icon={<PencilSimpleIcon size={20} weight="bold" color={color.primary} />}
          title="Display name"
          detail={profile?.displayName || 'Add your name'}
          onPress={() => setRename(true)}
          a11y="Change your display name"
        />
        {cohorts.map((c) => (
          <Row
            key={c.id}
            icon={<UsersThreeIcon size={20} weight="bold" color={color.primary} />}
            title={c.name}
            detail={`With ${c.trainerName} · code ${c.joinCode}`}
            trailing={<TextLink label="Leave" onPress={() => setLeaving(c)} />}
          />
        ))}
        <Row
          icon={<UsersThreeIcon size={20} weight="bold" color={color.faint} />}
          title={cohorts.length ? 'Join another cohort' : 'Join your cohort'}
          detail="Enter the code your trainer shared"
          onPress={() => router.push('/join')}
          a11y="Join a cohort"
        />
        <SyncRow />
        <Row
          icon={<SignOutIcon size={20} weight="bold" color={color.muted} />}
          title="Sign out"
          detail="Your practice is saved to your account"
          onPress={openSignOut}
          a11y="Sign out"
          last
        />
      </Raised>

      <RenameSheet open={rename} onClose={() => setRename(false)} />
      <ConfirmSheet
        open={!!leaving}
        onClose={() => setLeaving(null)}
        title={`Leave ${leaving?.name ?? 'this cohort'}?`}
        body={`You’ll stop seeing ${leaving?.trainerName ?? 'your trainer'}’s assignments, and you can’t share new sessions with them. Your practice stays yours. Rejoin any time with the code.`}
        stay="Stay in the cohort"
        leave="Leave"
        onLeave={async () => {
          const c = leaving;
          setLeaving(null);
          if (c && profile && (await leaveCohort(profile.id, c.id))) haptic.press();
        }}
      />
      <ConfirmSheet
        open={out}
        onClose={unsynced ? waitForSync : closeSignOut}
        title="Sign out?"
        body={
          unsynced
            ? 'Some practice hasn’t synced yet. Sign out anyway? Whatever hasn’t sent is only on this phone, and signing out removes it.'
            : 'Your practice is saved to your account. This device starts fresh for the next person, and you can sign back in any time to pick up where you left off.'
        }
        stay={unsynced ? 'Wait' : 'Stay signed in'}
        leave={unsynced ? 'Sign out anyway' : 'Sign out'}
        busy={outStep === 'saving'}
        onLeave={unsynced ? signOutAnyway : confirmSignOut}
      />
    </>
  );
}

/** "All practice synced" or "3 waiting to sync", ticking over as the outbox drains. */
function SyncRow() {
  const uid = useAccount((s) => s.profile?.id);
  const offline = useAccount((s) => s.offline);
  // a retry is pending: something already failed to send, so say it's waiting rather than "sending"
  const stalled = useOutbox((s) => s.stalled);
  const pending = useOutbox((s) => s.entries.filter((e) => e.userId === uid).length + (uid && s.stateDirty[uid] ? 1 : 0));
  const tick = useTickSwap();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const label = pending ? `${pending} waiting to sync` : 'All practice synced';
  const detail = pending ? (offline || stalled ? 'Saved on this phone. Sends when you’re online.' : 'Sending now') : 'Progress and practice are backed up';
  return (
    <Row
      icon={pending ? <CloudArrowUpIcon size={20} weight="bold" color={color.primary} /> : <CloudCheckIcon size={20} weight="bold" color={color.primary} />}
      title={
        <Animated.View key={label} entering={mounted ? tick.entering : undefined}>
          <Text variant="bodyStrong">{label}</Text>
        </Animated.View>
      }
      detail={detail}
      trailing={pending ? <TextLink label="Retry" onPress={() => void syncNow()} /> : undefined}
    />
  );
}

function RenameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useAccount((s) => s.profile);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kb = useKeyboardHeight();
  useEffect(() => {
    if (open) {
      setName(profile?.needsName ? '' : (profile?.displayName ?? ''));
      setError(null);
    }
  }, [open, profile?.displayName, profile?.needsName]);

  const save = async () => {
    if (!profile || !name.trim()) return;
    setBusy(true);
    const ok = await renameSelf(profile.id, name);
    setBusy(false);
    if (!ok) return setError('That didn’t save. Check your connection and try again.');
    haptic.success();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} accessibilityLabel="Change your display name">
      <Text variant="heading" accessibilityRole="header">
        Your name
      </Text>
      <Text variant="body" color={color.muted} style={styles.sheetLede}>
        Your trainer sees this next to anything you share.
      </Text>
      <TextField
        label="Display name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError(null);
        }}
        autoFocus
        maxLength={80}
        autoCapitalize="words"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={save}
        invalid={!!error}
        style={styles.sheetField}
      />
      <Notice text={error} />
      <Button label={busy ? 'Saving…' : 'Save'} fullWidth disabled={busy || !name.trim()} onPress={save} style={styles.sheetBtn} />
      <View style={{ height: kb }} />
    </BottomSheet>
  );
}

function Row({
  icon,
  title,
  detail,
  onPress,
  trailing,
  a11y,
  last,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail: string;
  onPress?: () => void;
  trailing?: ReactNode;
  a11y?: string;
  last?: boolean;
}) {
  const press = usePressScale(0.98);
  const body = (
    <Animated.View style={[styles.row, onPress && press.style]}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.flex}>
        {typeof title === 'string' ? <Text variant="bodyStrong">{title}</Text> : title}
        <Text variant="caption" color={color.muted} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      {trailing ?? (onPress ? <CaretRightIcon size={18} weight="bold" color={color.faint} /> : null)}
    </Animated.View>
  );
  return (
    <View style={!last && styles.rule}>
      {onPress ? (
        <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={a11y}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

/** The signed-in profile header (name, email, avatar). */
export function ProfileHead({ courseChip }: { courseChip: ReactNode }) {
  const profile = useAccount((s) => s.profile);
  const name = profile?.displayName || 'You';
  return (
    <View style={styles.profile}>
      <Avatar seed={personSeed(name)} size={72} accessibilityLabel={name} />
      <View style={styles.flex}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color={color.muted} numberOfLines={1}>
          {profile?.email}
        </Text>
        {courseChip}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  guest: { padding: space[5], gap: space[2] },
  guestBtn: { marginTop: space[3] },
  restart: { alignSelf: 'center', marginTop: space[2] },
  list: { paddingHorizontal: space[4] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingVertical: space[3],
  },
  rule: { borderBottomWidth: 2, borderBottomColor: color.rule },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLede: { marginTop: space[2] },
  sheetField: { marginTop: space[5] },
  sheetBtn: { marginTop: space[5] },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
});
