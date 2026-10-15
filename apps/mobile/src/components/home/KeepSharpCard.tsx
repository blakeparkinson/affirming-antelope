import { getSkill } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import { Button, HourglassIcon, Pip, Raised, Text, color, radius, space } from '@/design';
import type { KeepSharpView } from '@/data/keepSharp';

const daysAgo = (d: number) => (d === 1 ? 'yesterday' : `${d} days ago`);

/**
 * "Keep it sharp": a skill practised a while ago has faded. The bar is how sharp it is now;
 * REFRESH opens a short drill on it, which restores it (the row in Your progress fills back up).
 */
export function KeepSharpCard({ faded, onRefresh }: { faded: KeepSharpView; onRefresh: () => void }) {
  const name = getSkill(faded.skill).name;
  const pct = Math.round(faded.sharpness * 100);
  const more = faded.count - 1;
  return (
    <Raised contentStyle={styles.face}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <HourglassIcon size={24} weight="fill" color={color.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="overline" color={color.primaryShadow}>
            Keep it sharp
          </Text>
          <Text variant="subheading">{name} is fading</Text>
          <Text variant="caption" color={color.muted}>
            Last practised {daysAgo(faded.calendarDays)}. A two-minute drill brings it back.
            {more > 0 ? ` ${more} more ${more === 1 ? 'skill is' : 'skills are'} fading too.` : ''}
          </Text>
        </View>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`${name} is ${pct}% sharp`} accessibilityValue={{ min: 0, max: 100, now: pct }} style={styles.meter}>
        <Pip fill={faded.sharpness} tint={color.primary} height={8} settled />
      </View>
      <Button variant="secondary" size="md" label="Refresh" fullWidth onPress={onRefresh} accessibilityLabel={`Refresh ${name}: a two-minute drill`} />
    </Raised>
  );
}

const styles = StyleSheet.create({
  face: { padding: space[4] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1, gap: 2 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meter: { marginTop: space[4], marginBottom: space[4] },
});
