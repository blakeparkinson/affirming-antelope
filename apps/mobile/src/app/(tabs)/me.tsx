import { MAX_FREEZES, SKILLS } from '@antelope/core';
import { TrackSwitchSheet } from '@/components/track/TrackSwitchSheet';
import { trackName } from '@/data/pathways';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AccountSection, ProfileHead } from '@/components/me/AccountSection';
import { ReminderSettings } from '@/components/reminders/ReminderSettings';
import { remindersSupported } from '@/lib/reminders';
import { SkillLadder } from '@/components/me/SkillLadder';
import { TrainerInbox } from '@/components/me/TrainerInbox';
import { isSimulatedOffline, setSimulatedOffline, supabaseConfigured } from '@/lib/supabase';
import { syncNow } from '@/sync/engine';
import { personSeed, useAccount } from '@/state/account';
import {
  Avatar,
  CaretRightIcon,
  ChatsCircleIcon,
  Chip,
  FlagPennantIcon,
  Hoofprint,
  PressableSurface,
  Raised,
  Screen,
  SnowflakeIcon,
  StethoscopeIcon,
  UsersThreeIcon,
  UserIcon,
  Switch,
  Text,
  color,
  radius,
  space,
} from '@/design';
import { Enter, RollingNumber, usePressScale } from '@/motion';
import { pathwaySkills, useActivePathway, useFreezesHeld, useCurrentWeek, weekLabel as weekOf } from '@/state/selectors';
import { liveStreak, useLearner } from '@/state/store';

export default function Me() {
  const s = useLearner();
  const signedIn = useAccount((a) => a.status === 'signed-in');
  const cohorts = useAccount((a) => a.cohorts);
  const pending = useAccount((a) => a.submissions.filter((x) => x.status === 'submitted').length);
  const pathway = useActivePathway();
  const currentWeek = useCurrentWeek();
  const freezes = useFreezesHeld();
  const weekLabel = `${pathway.title} · ${weekOf(pathway, currentWeek)}`;
  const [switchOpen, setSwitchOpen] = useState(false);
  // the active track's skills first, in the order its course reaches them
  const taught = pathwaySkills(pathway);
  const ladder = SKILLS.filter((sk) => taught.includes(sk.id)).sort((a, b) => taught.indexOf(a.id) - taught.indexOf(b.id));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }, []);
  const trainer = signedIn ? cohorts[0] : null;
  // guests have no trainer; the demo learner shows the sample one
  const showTrainer = signedIn ? !!trainer : s.demo && !!s.assignment;

  return (
    <Screen refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}>
      <Enter>
        {signedIn ? (
          <ProfileHead courseChip={<Chip label={weekLabel} tone="soft" style={styles.course} />} />
        ) : s.demo ? (
          <View style={styles.profile}>
            <Avatar seed="amanda-demo-learner" size={72} accessibilityLabel={s.firstName} />
            <View style={styles.profileCopy}>
              <Text variant="title" accessibilityRole="header">
                {s.firstName}
              </Text>
              <Text variant="caption" color={color.muted}>
                {s.role}
              </Text>
              <Chip label={weekLabel} tone="soft" style={styles.course} />
            </View>
          </View>
        ) : (
          <View style={styles.profile}>
            <View style={styles.guestAvatar}>
              <UserIcon size={34} weight="bold" color={color.primary} />
            </View>
            <View style={styles.profileCopy}>
              <Text variant="title" accessibilityRole="header">
                Your practice
              </Text>
              <Text variant="caption" color={color.muted}>
                Saved on this phone
              </Text>
              <Chip label={weekLabel} tone="soft" style={styles.course} />
            </View>
          </View>
        )}
      </Enter>

      <Enter index={1} style={styles.stats}>
        <Stat label="day streak" value={liveStreak(s)} icon={<Hoofprint size={22} tint={color.gold} rotate={-12} />} />
        <Stat label="scenarios done" value={s.scenariosCompleted} icon={<ChatsCircleIcon size={22} weight="fill" color={color.primary} />} />
        <Stat label="weekly goals hit" value={s.weeklyGoal.hitCount} icon={<FlagPennantIcon size={22} weight="fill" color={color.gold} />} />
      </Enter>

      <Enter index={1}>
        <Raised style={styles.freezes}>
          <View style={styles.freezesFace} accessible accessibilityLabel={`Streak freezes: ${freezes} of ${MAX_FREEZES}. ${FREEZE_HINT}`}>
            <View style={styles.freezeSlots}>
              {Array.from({ length: MAX_FREEZES }, (_, i) => (
                <View key={i} style={[styles.freezeSlot, i < freezes && styles.freezeSlotHeld]}>
                  <SnowflakeIcon size={20} weight="bold" color={i < freezes ? color.primary : color.faint} />
                </View>
              ))}
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                {freezes} of {MAX_FREEZES} streak freezes
              </Text>
              <Text variant="caption" color={color.muted}>
                {FREEZE_HINT}
              </Text>
            </View>
          </View>
        </Raised>
      </Enter>

      <Enter index={2}>
        <SectionHeader title="Your track" />
        <PressableSurface
          onPress={() => setSwitchOpen(true)}
          haptic="tick"
          pressScale={0.985}
          contentStyle={styles.trackRow}
          accessibilityLabel={`${pathway.title}, ${weekOf(pathway, currentWeek)}. Switch track`}
        >
          <View style={styles.trackIcon}>
            {pathway.setting === 'clinical' ? (
              <StethoscopeIcon size={24} weight="fill" color={color.primary} />
            ) : (
              <UsersThreeIcon size={24} weight="fill" color={color.primary} />
            )}
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{trackName(pathway.id)}</Text>
            <Text variant="caption" color={color.muted} numberOfLines={1}>
              {pathway.title} · {weekOf(pathway, currentWeek)}
            </Text>
          </View>
          <Text variant="label" color={color.primary}>
            Switch
          </Text>
          <CaretRightIcon size={18} weight="bold" color={color.primary} />
        </PressableSurface>
      </Enter>

      <Enter index={2}>
        <SectionHeader title="Skill levels" />
        <Text variant="body" color={color.muted} style={styles.explain}>
          Each skill climbs six levels, from Recognize to Advanced. No scores, just what you can do.
        </Text>
        <Raised contentStyle={styles.list}>
          {ladder.map((sk, i) => (
            <SkillLadder key={sk.id} skill={sk} progress={s.skills[sk.id]} last={i === ladder.length - 1} />
          ))}
        </Raised>
      </Enter>

      {signedIn ? (
        <Enter index={3}>
          <SectionHeader title="From your trainer" />
          <TrainerInbox />
        </Enter>
      ) : null}

      {showTrainer ? (
        <Enter index={3}>
          <SectionHeader title="Your trainer" />
          <Raised contentStyle={styles.trainer}>
            <Avatar
              seed={trainer ? personSeed(trainer.trainerName) : 'rosa-lin-trainer'}
              size={52}
              accessibilityLabel={trainer?.trainerName ?? s.assignment?.assignedBy.name}
            />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{trainer?.trainerName ?? s.assignment?.assignedBy.name}</Text>
              <Text variant="caption" color={color.muted} numberOfLines={2}>
                {trainer ? `${trainer.name} · reviews what you share` : `${s.assignment?.assignedBy.role} · reviews your role-plays`}
              </Text>
            </View>
            {signedIn ? (
              <Chip label={pending ? `${pending} in review` : 'Nothing waiting'} tone={pending ? 'primary' : 'neutral'} />
            ) : (
              <Chip label="Sample" tone="neutral" />
            )}
          </Raised>
        </Enter>
      ) : null}

      {supabaseConfigured ? (
        <Enter index={4}>
          <SectionHeader title="Account" />
          <AccountSection />
        </Enter>
      ) : null}

      <Enter index={5}>
        <SectionHeader title="Settings" />
        <Raised contentStyle={styles.settings}>
          {remindersSupported ? <ReminderSettings rowStyle={[styles.row, styles.rule]} /> : null}
          <SettingRow title="Reduce motion" detail="Cross-fades instead of movement">
            <Switch
              accessibilityLabel="Reduce motion"
              value={s.settings.motion === 'reduce'}
              onChange={(v) => s.setSetting('motion', v ? 'reduce' : 'system')}
            />
          </SettingRow>
          <SettingRow title="Haptics" detail="Taps and ticks on supported phones" last>
            <Switch accessibilityLabel="Haptics" value={s.settings.haptics} onChange={(v) => s.setSetting('haptics', v)} />
          </SettingRow>
        </Raised>

        {/* signed in, progress lives on the account, so the demo tools are dev-only there */}
        {signedIn && !__DEV__ ? null : (
          <>
            <Text variant="overline" color={color.muted} style={styles.demoLabel}>
              Demo
            </Text>
            <Raised contentStyle={styles.settings}>
              {__DEV__ ? (
                <SettingRow title="Demo learner" detail="Amanda’s seeded week 4, for demos. Off starts fresh.">
                  <Switch accessibilityLabel="Demo learner" value={s.demo} onChange={(v) => s.setDemo(v)} />
                </SettingRow>
              ) : null}
              {__DEV__ && supabaseConfigured ? <OfflineToggle /> : null}
              <LinkRow
                title="Preview the completed pathway"
                onPress={() => {
                  s.previewPathwayComplete();
                  router.navigate('/path');
                }}
              />
              {__DEV__ ? (
                <LinkRow
                  title="Replay path unlock"
                  onPress={() => {
                    s.replayPathUnlock();
                    router.navigate('/path');
                  }}
                />
              ) : null}
              {/* a local reset would just sync back from the account */}
              {signedIn ? null : <LinkRow title={s.demo ? 'Reset demo data' : 'Start this track over'} onPress={() => s.resetProgress()} last />}
            </Raised>
          </>
        )}
      </Enter>
      <TrackSwitchSheet
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        source="me"
        onSwitched={() => setTimeout(() => router.navigate('/path'), 320)}
      />
    </Screen>
  );
}

/** Dev only: make every Supabase request fail like a dropped connection, to watch the outbox work. */
function OfflineToggle() {
  const [on, setOn] = useState(isSimulatedOffline());
  useEffect(() => setOn(isSimulatedOffline()), []);
  return (
    <SettingRow title="Simulate offline" detail="Supabase requests fail until you turn this off">
      <Switch
        accessibilityLabel="Simulate offline"
        value={on}
        onChange={(v) => {
          setSimulatedOffline(v);
          setOn(v);
        }}
      />
    </SettingRow>
  );
}

const FREEZE_HINT = 'A freeze covers a missed day so your streak survives. Hit your weekly goal to earn one.';

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Raised style={styles.stat} contentStyle={styles.statFace}>
      {icon}
      <RollingNumber value={value} variant="heading" delay={250} />
      <Text variant="caption" color={color.muted} numberOfLines={2}>
        {label}
      </Text>
    </Raised>
  );
}

function SettingRow({ title, detail, last, children }: { title: string; detail: string; last?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.row, !last && styles.rule]}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color={color.muted}>
          {detail}
        </Text>
      </View>
      {children}
    </View>
  );
}

function LinkRow({ title, onPress, last }: { title: string; onPress: () => void; last?: boolean }) {
  const press = usePressScale(0.98);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      style={[styles.row, !last && styles.rule]}
    >
      <Text variant="bodyStrong" color={color.primary} style={styles.flex}>
        {title}
      </Text>
      <CaretRightIcon size={18} weight="bold" color={color.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  profileCopy: { flex: 1 },
  guestAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], minHeight: 72 },
  trackIcon: { width: 44, height: 44, borderRadius: radius.badge, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  course: { marginTop: space[2] },
  stats: { flexDirection: 'row', gap: space[3], marginTop: space[6] },
  freezes: { marginTop: space[3] },
  freezesFace: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  freezeSlots: { flexDirection: 'row', gap: space[2] },
  freezeSlot: {
    width: 36,
    height: 36,
    borderRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
  },
  freezeSlotHeld: { backgroundColor: color.soft, borderColor: color.primaryTint },
  stat: { flex: 1 },
  statFace: { padding: space[3], paddingVertical: space[4], gap: 2, alignItems: 'flex-start' },
  explain: { marginTop: -space[1], marginBottom: space[3] },
  list: { paddingHorizontal: space[4], paddingVertical: space[1] },
  trainer: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  flex: { flex: 1 },
  settings: { paddingHorizontal: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3] },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  demoLabel: { marginTop: space[6], marginBottom: space[2] },
});
