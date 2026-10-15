// Dev-only avatar sheet (renders nothing in release builds).
//   antelope://dev/avatars?size=64&setting=clinical
// Rows: the scenario cast as the app resolves it (scenarioAvatar), then a fixed set of seeds
// at each age band, so age cues can be checked side by side at a given size.
import { SCENARIOS } from '@antelope/core';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Text, color, scenarioAvatar, type AvatarAge, type AvatarSetting } from '@/design';

const SEEDS = ['maya-chen', 'jordan-price', 'ruth-okafor', 'harold-reyes', 'dolores-garcia', 'walter-brown'];
const AGES: { label: string; age: AvatarAge }[] = [
  { label: 'young', age: 'young' },
  { label: 'adult', age: 'adult' },
  { label: '55', age: 55 },
  { label: '68', age: 68 },
  { label: '82', age: 82 },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={color.muted}>
        {label}
      </Text>
      <View style={styles.cells}>{children}</View>
    </View>
  );
}

export default function DevAvatars() {
  const q = useLocalSearchParams<{ size?: string; setting?: string }>();
  const size = Number(q.size ?? 56);
  const setting: AvatarSetting = q.setting === 'workplace' || q.setting === 'sports' ? q.setting : 'clinical';
  if (!__DEV__) return null;
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Row label="Scenario cast (scenarioAvatar)">
        {SCENARIOS.map((sc) => (
          <Avatar key={sc.id} {...scenarioAvatar(sc)} size={size} accessibilityLabel={sc.persona.name} />
        ))}
      </Row>
      {AGES.map((a) => (
        <Row key={a.label} label={`${setting} · ${a.label}`}>
          {SEEDS.map((s) => (
            <Avatar key={s} seed={s} age={a.age} setting={setting} size={size} />
          ))}
        </Row>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 72, paddingHorizontal: 16, paddingBottom: 48, gap: 14, backgroundColor: color.white },
  row: { gap: 6 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
