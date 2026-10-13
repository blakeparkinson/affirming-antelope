import { SKILLS, getSkill, type SkillId } from '@antelope/core';
import { useLocalSearchParams } from 'expo-router';
import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ChallengeSheet } from '@/components/practice/ChallengeSheet';
import { SkillTile } from '@/components/practice/SkillTile';
import { SETTING_COPY, availability, challengeReason, planFor, tileNote } from '@/components/practice/plan';
import {
  ArrowRightIcon,
  Avatar,
  Button,
  CaretRightIcon,
  PressableSurface,
  Screen,
  SegmentedControl,
  ShuffleIcon,
  Text,
  TextLink,
  color,
  haptic,
  layout,
  scenarioAvatar,
  radius,
  space,
  type as typeScale,
} from '@/design';
import { openDrill, openRoleplay, pickDrill, pickScenario } from '@/data/routes';
import { otherSetting, scenariosForSetting } from '@/data/pathways';
import { Enter, useTickSwap } from '@/motion';
import { launchFrom } from '@/motion/launch';
import { useCurrentUnit, useSetting } from '@/state/selectors';
import { useLearner } from '@/state/store';

type Minutes = 5 | 10 | 15;

export default function Practice() {
  const insets = useSafeAreaInsets();
  const skills = useLearner((s) => s.skills);
  const unit = useCurrentUnit();
  const activeSetting = useSetting();
  const tick = useTickSwap();
  // Which setting this tab is showing. Defaults to the active track's; the quiet link flips it.
  const [setting, setSetting] = useState(activeSetting);
  useEffect(() => setSetting(activeSetting), [activeSetting]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const pool = useMemo(() => scenariosForSetting(setting), [setting]);
  const noChallenge = challengeReason(pool, setting);
  const other = otherSetting(setting);
  const toggleLabel = setting === activeSetting ? `Try ${SETTING_COPY[other].track} instead` : `Back to ${SETTING_COPY[activeSetting].track}`;
  const [minutes, setMinutes] = useState<Minutes>(5);
  const [skill, setSkill] = useState<SkillId>(unit?.skills[0] ?? 'oars');
  const [challenge, setChallenge] = useState(false);
  const { challenge: challengeParam } = useLocalSearchParams<{ challenge?: string }>();

  // Home's "Challenge me" tile lands here and opens the shuffle.
  useEffect(() => {
    if (challengeParam) setChallenge(true);
  }, [challengeParam]);

  const isDrill = minutes === 5;
  const plan = planFor(skill, setting, isDrill);
  const sessionMinutes = plan.kind === 'roleplay' && isDrill ? 10 : minutes;
  const tiles = useMemo(() => Object.fromEntries(SKILLS.map((s) => [s.id, { card: createRef<View>(), title: createRef<View>() }])), []);
  const startRef = useRef<View>(null);
  // the session opens out of the selected skill tile; for a role-play, START also becomes the brief's START
  const start = () => {
    const name = getSkill(skill).name;
    launchFrom(
      {
        container: tiles[skill].card,
        depth: 4,
        face: color.soft,
        radius: radius.surface,
        title: { ref: tiles[skill].title, text: name, style: { ...typeScale.subheading, color: color.primaryShadow } },
        cta: plan.kind === 'drill' ? undefined : { ref: startRef, face: color.primary, radius: radius.md, label: 'START', labelStyle: { ...typeScale.button, color: color.white } },
      },
      () => {
        if (plan.kind === 'drill') openDrill(pickDrill(skill, skills[skill].level, plan.setting), { minutes: sessionMinutes, source: 'practice' });
        else openRoleplay(pickScenario(skill, plan.setting).id, { minutes: sessionMinutes, source: 'practice' });
      },
    );
  };

  return (
    <View style={styles.root}>
      <Screen contentContainerStyle={{ paddingBottom: insets.bottom + layout.tabBarHeight + 120 }}>
        <Enter>
          <Text variant="title" accessibilityRole="header">
            Open practice
          </Text>
          <Text variant="body" color={color.muted} style={styles.lede}>
            Pick your time and a skill. We’ll find the right rep.
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingNow}>
              <Animated.View key={setting} entering={mounted.current ? tick.entering : undefined}>
                <Text variant="label" color={color.muted} numberOfLines={1}>
                  {SETTING_COPY[setting].with}
                </Text>
              </Animated.View>
            </View>
            <TextLink
              label={toggleLabel}
              onPress={() => {
                haptic.tick();
                setSetting(other);
              }}
              entering={mounted.current ? tick.entering : undefined}
            />
          </View>
        </Enter>

        <Enter index={1} style={styles.block}>
          <Text variant="subheading" style={styles.q}>
            I have…
          </Text>
          <SegmentedControl<Minutes>
            accessibilityLabel="How much time do you have?"
            value={minutes}
            onChange={setMinutes}
            segments={[
              { value: 5, label: '5 min', hint: 'Drill' },
              { value: 10, label: '10 min', hint: 'Role-play' },
              { value: 15, label: '15 min', hint: 'Role-play' },
            ]}
          />
        </Enter>

        <Enter index={2}>
          <PressableSurface
            tone="navy"
            depth={5}
            radius={radius.surface}
            onPress={() => setChallenge(true)}
            disabled={!!noChallenge}
            accessibilityLabel={noChallenge ? `Challenge me. ${noChallenge}.` : 'Challenge me: a random role-play scenario'}
            style={styles.challenge}
            contentStyle={styles.challengeFace}
          >
            <View style={[styles.shuffle, noChallenge ? styles.shuffleOff : null]}>
              <ShuffleIcon size={24} weight="bold" color={noChallenge ? color.muted : color.navy} />
            </View>
            <View style={styles.challengeCopy}>
              <Text variant="subheading" color={noChallenge ? color.ink : color.white}>
                Challenge me
              </Text>
              <Animated.View key={noChallenge ?? 'ready'} entering={mounted.current ? tick.entering : undefined}>
                <Text variant="caption" color={noChallenge ? color.muted : 'rgba(255,255,255,0.75)'}>
                  {noChallenge ?? 'A random scenario, any skill'}
                </Text>
              </Animated.View>
            </View>
            {noChallenge ? null : (
              <Animated.View key={setting} entering={mounted.current ? tick.entering : undefined} style={styles.cast}>
                {pool.slice(0, 3).map((s, i) => (
                  <View key={s.id} style={[styles.castItem, { marginLeft: i ? -14 : 0, zIndex: 3 - i }]}>
                    <Avatar {...scenarioAvatar(s)} size={34} />
                  </View>
                ))}
              </Animated.View>
            )}
            {noChallenge ? null : <CaretRightIcon size={18} weight="bold" color="rgba(255,255,255,0.7)" />}
          </PressableSurface>
        </Enter>

        <Enter index={3}>
          <SectionHeader title="What do you want to practice?" />
          <View style={styles.grid} accessibilityRole="radiogroup">
            {SKILLS.map((s) => (
              <SkillTile
                key={s.id}
                skill={s}
                progress={skills[s.id]}
                selected={s.id === skill}
                note={tileNote(availability(s.id, setting), setting)}
                onPress={() => setSkill(s.id)}
                heroRefs={tiles[s.id]}
              />
            ))}
          </View>
        </Enter>
      </Screen>

      <View style={[styles.dock, { bottom: insets.bottom + layout.tabBarHeight }]}>
        <View style={styles.dockInner}>
          <View style={styles.dockCopy}>
            <Text variant="caption" color={color.muted} numberOfLines={1}>
              {plan.kind === 'drill' ? `${sessionMinutes}-minute drill` : `${sessionMinutes}-minute role-play`}
              {plan.note ? ` · ${plan.note}` : ''}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {getSkill(skill).name}
            </Text>
          </View>
          <View ref={startRef} collapsable={false}>
          <Button
            label="Start"
            onPress={start}
            icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />}
            accessibilityLabel={`Start a ${sessionMinutes}-minute ${plan.kind === 'drill' ? 'drill' : 'role-play'} on ${getSkill(skill).name}${plan.note ? `, ${plan.note}` : ''}`}
          />
          </View>
        </View>
      </View>

      <ChallengeSheet
        open={challenge}
        onClose={() => setChallenge(false)}
        scenarios={pool}
        setting={setting}
        onStart={(s) => {
          setChallenge(false);
          setTimeout(() => openRoleplay(s.id, { minutes: 12, source: 'challenge' }), 180);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  lede: { marginTop: space[1] },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], marginTop: space[2] },
  settingNow: { flexShrink: 1 },
  block: { marginTop: space[6] },
  q: { marginBottom: space[3] },
  challenge: { marginTop: space[5] },
  challengeFace: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  shuffle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleOff: { backgroundColor: color.line },
  challengeCopy: { flex: 1 },
  cast: { flexDirection: 'row' },
  castItem: { borderRadius: 19, borderWidth: 2, borderColor: color.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.white,
    borderTopWidth: 2,
    borderTopColor: color.line,
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[3],
  },
  dockInner: { flexDirection: 'row', alignItems: 'center', gap: space[4], maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  dockCopy: { flex: 1 },
});
