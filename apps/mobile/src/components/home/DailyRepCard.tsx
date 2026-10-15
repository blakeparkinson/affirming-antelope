import { getSkill } from '@antelope/core';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRightIcon, Button, Chip, Raised, Text, color, radius, space, type as typeScale } from '@/design';
import type { DailyRepView } from '@/data/dailyRep';
import { launchFrom } from '@/motion/launch';

const DEPTH = 6;

/**
 * Home's one unmistakable next action: the daily rep, a cobalt card whose only control
 * is START (ONE MORE once today's rep is done). It's also the hero source for the
 * practice screen: the button measures the card, its title and itself, and the drill
 * opens out of them (SessionSurface). After the rep the card says so, and ONE MORE
 * opens the next pick with its own title in the header.
 */
export function DailyRepCard({ rep, onStart }: { rep: DailyRepView; onStart: (drillId: string) => void }) {
  const card = useRef<View>(null);
  const title = useRef<View>(null);
  const cta = useRef<View>(null);
  const next = rep.done ? rep.oneMore : null;
  const drillId = next?.drillId ?? rep.drillId;
  // done: several drills share a course title, so the card says it's done and names the next one below
  const heading = rep.done ? 'Today’s rep is done' : rep.title;
  const skill = getSkill(next?.skill ?? rep.skill).name;
  const label = next ? 'One more' : 'Start';
  const start = () =>
    launchFrom(
      {
        container: card,
        depth: DEPTH,
        face: color.primary,
        radius: radius.lg,
        // after the rep the card's title isn't the drill's, so only the header gets it
        ...(next ? { headerTitle: next.title } : { title: { ref: title, text: heading, style: { ...typeScale.hero, color: color.white } } }),
        cta: { ref: cta, face: color.white, radius: radius.md, label: label.toUpperCase(), labelStyle: { ...typeScale.button, color: color.primary } },
      },
      () => onStart(drillId),
    );
  return (
    <View ref={card} collapsable={false}>
      <Raised tone="primary" depth={DEPTH} radius={radius.lg} contentStyle={styles.face}>
        <Text variant="overline" color={color.onPrimaryMuted}>
          Daily rep
        </Text>
        <View ref={title} collapsable={false} style={styles.title}>
          <Text variant="hero" color={color.white}>
            {heading}
          </Text>
        </View>
        <View style={styles.chips}>
          <Chip tone="onPrimary" label={skill} />
          <Chip tone="onPrimary" label={`Drill · ~${rep.minutes} min`} />
        </View>
        <Text variant="body" color={color.onPrimaryBody} style={styles.why}>
          {rep.done
            ? next
              ? `Your streak is safe. Up for one more? Next: ${next.title}.`
              : 'Your streak is safe. See you tomorrow.'
            : `One short drill on ${getSkill(rep.skill).name}, picked for you. Two minutes keeps your streak going.`}
        </Text>
        {next || !rep.done ? (
          <View ref={cta} collapsable={false}>
            <Button
              variant="onPrimary"
              label={label}
              onPress={start}
              fullWidth
              icon={<ArrowRightIcon size={20} weight="bold" color={color.primary} />}
              accessibilityLabel={`${label}: ${next?.title ?? heading}`}
            />
          </View>
        ) : null}
      </Raised>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { padding: space[5], paddingTop: space[5] + 2 },
  title: { marginTop: space[2], maxWidth: 300, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  why: { marginTop: space[3], marginBottom: space[5] },
});
