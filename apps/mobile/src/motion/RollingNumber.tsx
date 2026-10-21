import { useEffect } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '@/design/Text';
import { color, type as typeScale, type TypeVariant } from '@/design/tokens';
import { STAGGER } from './constants';
import { spring } from './springs';
import { useReduceMotion } from './useMotionPrefs';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Props {
  value: number;
  variant?: TypeVariant;
  /** Line height of one digit, pt. Defaults to the variant's line height. */
  lineHeight?: number;
  color?: string;
  /** Start rolling from this value on mount (default 0). */
  from?: number;
  delay?: number;
  style?: TextStyle;
}

/**
 * Odometer-style counter. Each digit is a strip of 0-9 that springs to its
 * place; digits land right-to-left, 45ms apart. Reduced motion: no roll.
 */
export function RollingNumber({ value, variant = 'number', lineHeight, color: tint = color.ink, from = 0, delay = 0, style }: Props) {
  const digits = String(Math.max(0, Math.round(value))).split('');
  const start = String(Math.max(0, Math.round(from))).padStart(digits.length, '0').slice(-digits.length);
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={String(value)}>
      {digits.map((d, i) => (
        <Digit
          key={`${digits.length}-${i}`}
          digit={Number(d)}
          from={Number(start[i])}
          variant={variant}
          lineHeight={lineHeight}
          color={tint}
          delay={delay + (digits.length - 1 - i) * STAGGER}
          style={style}
        />
      ))}
    </View>
  );
}

function Digit({
  digit,
  from,
  variant,
  lineHeight,
  color: tint,
  delay,
  style,
}: {
  digit: number;
  from: number;
  variant: TypeVariant;
  lineHeight?: number;
  color: string;
  delay: number;
  style?: TextStyle;
}) {
  const reduce = useReduceMotion();
  const lh = lineHeight ?? typeScale[variant].lineHeight;
  const y = useSharedValue(reduce ? digit : from);

  useEffect(() => {
    // roll at least one full turn upward when the digit changes, like a counter ticking over
    y.value = reduce ? withTiming(digit, { duration: 0 }) : withDelay(delay, withSpring(digit, spring.gentle));
  }, [digit, reduce, delay, y]);

  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: -y.value * lh }] }));

  return (
    <View style={{ height: lh, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      {/* ghost digit sizes the column */}
      <Text variant={variant} style={[{ lineHeight: lh, opacity: 0 }, style]} maxScale={1}>
        {digit}
      </Text>
      {/* the strip is decoration: the ghost digit above is what a screen reader hears */}
      <Animated.View style={[StyleSheet.absoluteFill, strip]} aria-hidden>
        {DIGITS.map((n) => (
          <Text key={n} variant={variant} style={[{ lineHeight: lh, height: lh, color: tint }, style]} maxScale={1}>
            {n}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
