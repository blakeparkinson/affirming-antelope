import { router } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';
import { HourglassIcon, TextLink, UserIcon, WifiSlashIcon, color } from '@/design';
import type { FriendlyError } from './errors';

/**
 * An hourglass for "not now" stops (practice limits, the coach resting), a person for a
 * session the coach couldn't check in, and the wifi glyph for connection trouble.
 */
export function ErrorIcon({ error, size }: { error: FriendlyError; size: number }) {
  if (error.kind === 'wait') return <HourglassIcon size={size} weight="bold" color={color.primary} />;
  if (error.kind === 'session') return <UserIcon size={size} weight="bold" color={color.primary} />;
  return <WifiSlashIcon size={size} weight="bold" color={color.primary} />;
}

/** A guest at today's free limit: signing in with their email (same uid, nothing lost) raises it. */
export function SaveProgressLink({ error, style }: { error: FriendlyError; style?: StyleProp<ViewStyle> }) {
  if (!error.signIn) return null;
  return (
    <TextLink
      label="Save my progress with email"
      caret
      onPress={() => router.push({ pathname: '/sign-in', params: { reason: 'quota' } })}
      style={style}
    />
  );
}
