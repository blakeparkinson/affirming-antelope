import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text, color, layout, space } from '@/design';
import { usePressScale } from '@/motion';

const STUDIO_URL = 'https://primemenagerie.com';
/** The studio's elephant: one colour on transparency, 240x171, tinted here to the text colour. */
const MARK = require('../../../assets/images/studio-mark.png');
const MARK_H = 14;

/** The quiet studio credit at the foot of Me. Opens primemenagerie.com in the browser. */
export function StudioCredit() {
  const press = usePressScale(0.97);
  return (
    <Pressable
      onPress={() => Linking.openURL(STUDIO_URL).catch(() => {})}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="link"
      accessibilityLabel="A Prime Menagerie app"
      accessibilityHint="Opens primemenagerie.com"
      style={styles.hit}
    >
      <Animated.View style={[styles.row, press.style]}>
        {/* decoration: the link's label already says whose mark it is */}
        <View aria-hidden>
          <Image source={MARK} tintColor={color.muted} contentFit="contain" style={styles.mark} />
        </View>
        <Text variant="caption" color={color.muted}>
          A Prime Menagerie app
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignSelf: 'center', justifyContent: 'center', minHeight: layout.minHit, paddingHorizontal: space[3], marginTop: space[6] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  mark: { height: MARK_H, width: Math.round((MARK_H * 240) / 171) },
});
