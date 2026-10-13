import { getSkill, type ScenarioSpec } from '@antelope/core';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { callName } from '@/components/practice-loop/names';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { HeroTarget, useSession } from '@/components/practice-loop/SessionSurface';
import { ArrowRightIcon, Avatar, Button, ChatCircleDotsIcon, Chip, FlagPennantIcon, Raised, TargetIcon, Text, UserIcon, color, scenarioAvatar, space } from '@/design';
import { Enter } from '@/motion';
import { primeSpeech } from './voice/speechPlayer';
import { ModeChoice, type ReplyMode } from './voice/VoiceBits';

export const DIFFICULTY: Record<ScenarioSpec['difficulty'], string> = { intro: 'Intro', intermediate: 'Intermediate', advanced: 'Advanced' };

/** Before the conversation: who, what's going on, your goal, and how it works. One action: start. */
export function Brief({
  scenario,
  onStart,
  onClose,
  mode,
  onMode,
  talkNote,
}: {
  scenario: ScenarioSpec;
  onStart: (avatar: View | null) => void;
  onClose: () => void;
  /** Talk or Type (remembered). */
  mode: ReplyMode;
  onMode: (m: ReplyMode) => void;
  /** Why Talk can't be picked here ("Not in this browser"). Unset: it can. */
  talkNote?: string;
}) {
  const p = scenario.persona;
  const avatar = useRef<View>(null);
  const heroTitle = useSession()?.title;
  const first = callName(p.name);
  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={onClose}
        center={
          heroTitle ? (
            <View style={styles.headCenter}>
              <HeroTarget name="title" fontSize={18}>
                <Text variant="subheading" numberOfLines={1}>
                  {heroTitle}
                </Text>
              </HeroTarget>
              <Text variant="caption" color={color.muted}>
                Role-play
              </Text>
            </View>
          ) : (
            <Text variant="overline" color={color.muted}>
              Role-play
            </Text>
          )
        }
      />
      <ScrollView contentContainerStyle={[sessionStyles.scroll, styles.content]} showsVerticalScrollIndicator={false}>
        <View style={sessionStyles.column}>
          <Enter from="scale" style={styles.person}>
            <View ref={avatar} collapsable={false}>
              <Avatar {...scenarioAvatar(scenario)} size={96} ring={color.white} accessibilityLabel={p.name} />
            </View>
            <View style={styles.personCopy}>
              <Text variant="title" accessibilityRole="header">
                {p.name}
              </Text>
              <Text variant="body" color={color.muted}>
                {p.role}
              </Text>
              <Text variant="caption" color={color.muted}>
                {p.tenure}
              </Text>
            </View>
          </Enter>

          <Enter index={1} style={styles.chips}>
            <Chip label={scenario.context} tone="soft" />
            <Chip label={DIFFICULTY[scenario.difficulty]} tone="neutral" />
          </Enter>

          <Enter index={2} style={styles.block}>
            <Text variant="heading">{scenario.title}</Text>
            <Text variant="body" style={styles.brief}>
              {scenario.learnerBrief}
            </Text>
          </Enter>

          <Enter index={3} style={styles.block}>
            <Raised tone="soft" depth={4} edge={color.primaryTint} shadow={color.primaryTint} contentStyle={styles.goal}>
              <View style={styles.goalHead}>
                <TargetIcon size={18} weight="bold" color={color.primary} />
                <Text variant="label" color={color.primaryShadow}>
                  Your goal
                </Text>
              </View>
              <Text variant="bodyStrong">{scenario.learnerGoal}</Text>
              <View style={styles.skills}>
                {scenario.targetSkills.map((s) => (
                  <Chip key={s} label={getSkill(s).name} tone="neutral" />
                ))}
              </View>
            </Raised>
          </Enter>

          <Enter index={4} style={styles.block}>
            <Text variant="subheading" style={styles.howTitle}>
              How it works
            </Text>
            <Step
              icon={<UserIcon size={18} weight="bold" color={color.primary} />}
              text={mode === 'talk' ? 'Hold the mic and say it the way you would in real life. Short is fine.' : 'Respond the way you would in real life. Short is fine.'}
            />
            <Step
              icon={<ChatCircleDotsIcon size={18} weight="bold" color={color.primary} />}
              text={`${first} reacts like a real person would, opening up or closing off depending on how you listen.`}
            />
            <Step icon={<FlagPennantIcon size={18} weight="bold" color={color.primary} />} text="End whenever you’re ready. You’ll reflect first, then see coach feedback." />
          </Enter>
        </View>
      </ScrollView>
      <Dock>
        <ModeChoice mode={mode} onMode={onMode} talkNote={talkNote} />
        <HeroTarget name="cta">
          <Button
            label="Start conversation"
            fullWidth
            onPress={() => {
              // web: this tap is a user gesture, so it unlocks the voice the reply will play in (iOS Safari)
              if (mode === 'talk') primeSpeech();
              onStart(avatar.current);
            }}
            icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />}
          />
        </HeroTarget>
      </Dock>
    </View>
  );
}

function Step({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>{icon}</View>
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headCenter: { alignItems: 'center', maxWidth: 240 },
  content: { paddingTop: space[2], paddingBottom: space[7] },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  personCopy: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[5] },
  block: { marginTop: space[6] },
  brief: { marginTop: space[2] },
  goal: { padding: space[5], gap: space[2] },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  howTitle: { marginBottom: space[3] },
  step: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start', marginBottom: space[3] },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
});
