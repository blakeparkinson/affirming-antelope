// Dev-only mascot playground (renders nothing in release builds).
//   antelope://dev/mascot?pose=wave&mood=idle&size=300&fire=wave&at=1200&every=0&impl=rive
// `fire` is a ref method or trigger (wave | hop | turn | cheer | nod | pronk | shiver | blink); `every` repeats it (ms);
// change `n` to re-run the same `fire` from a new deep link. `chrome=0` hides the controls (captures).
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, color } from '@/design';
import { MascotSprite } from '@/components/mascot/MascotSprite';
import { riveAvailable } from '@/components/mascot/riveAvailable';
import type { MascotHandle, MascotMood, MascotPose, MascotProps } from '@/components/mascot/types';

type Impl = ComponentType<MascotProps & RefAttributes<MascotHandle>>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RiveImpl: Impl | null = riveAvailable ? require('@/components/mascot/RiveMascot').RiveMascot : null;

const POSES: MascotPose[] = ['wave', 'celebrate', 'head'];
const MOODS: MascotMood[] = ['idle', 'listening', 'thinking', 'cheer'];
const ACTIONS = ['wave', 'hop', 'turn', 'cheer', 'nod', 'pronk', 'shiver', 'blink'] as const;
type Action = (typeof ACTIONS)[number];

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text variant="label" color={on ? color.white : color.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function MascotPlayground() {
  const q = useLocalSearchParams<{ pose?: string; mood?: string; size?: string; fire?: string; at?: string; every?: string; impl?: string; chrome?: string; n?: string }>();
  const [pose, setPose] = useState<MascotPose>((q.pose as MascotPose) ?? 'wave');
  const [mood, setMood] = useState<MascotMood>((q.mood as MascotMood) ?? 'idle');
  const [impl, setImpl] = useState<'rive' | 'sprite'>(q.impl === 'sprite' || !RiveImpl ? 'sprite' : 'rive');
  const size = Number(q.size ?? 300);
  const ref = useRef<MascotHandle>(null);
  // deep links into an already-open playground update it
  useEffect(() => {
    if (q.pose) setPose(q.pose as MascotPose);
    if (q.mood) setMood(q.mood as MascotMood);
    if (q.impl === 'sprite' || q.impl === 'rive') setImpl(q.impl === 'rive' && RiveImpl ? 'rive' : 'sprite');
  }, [q.pose, q.mood, q.impl]);

  const run = (a: Action) => {
    const m = ref.current as (MascotHandle & { fire?: (n: string) => void }) | null;
    if (!m) return;
    if (a === 'blink') m.fire?.(a);
    else m[a]();
  };

  useEffect(() => {
    const a = q.fire as Action | undefined;
    if (!a) return;
    const at = Number(q.at ?? 1200);
    const every = Number(q.every ?? 0);
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      run(a);
      if (every > 0) iv = setInterval(() => run(a), every);
    }, at);
    return () => {
      clearTimeout(t);
      if (iv) clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.fire, q.at, q.every, q.n, impl]);

  if (!__DEV__) return null;
  const Mascot: Impl = impl === 'rive' && RiveImpl ? RiveImpl : MascotSprite;
  const chrome = q.chrome !== '0';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={[styles.stage, { minHeight: size + 120 }]}>
        <Mascot key={impl} ref={ref} pose={pose} mood={mood} size={size} accessibilityLabel="Mascot playground" />
      </View>
      {chrome ? (
        <>
          <Text variant="label" color={color.muted}>
            {impl === 'rive' ? 'Rive (mascot-coach.riv)' : 'Sprite rig'} {RiveImpl ? '' : '- Rive unavailable'}
          </Text>
          <View style={styles.row}>{POSES.map((p) => <Chip key={p} label={p} on={p === pose} onPress={() => setPose(p)} />)}</View>
          <View style={styles.row}>{MOODS.map((m) => <Chip key={m} label={m} on={m === mood} onPress={() => setMood(m)} />)}</View>
          <View style={styles.row}>{ACTIONS.map((a) => <Chip key={a} label={a} onPress={() => run(a)} />)}</View>
          <View style={styles.row}>
            <Chip label="rive" on={impl === 'rive'} onPress={() => setImpl('rive')} />
            <Chip label="sprite" on={impl === 'sprite'} onPress={() => setImpl('sprite')} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  content: { paddingTop: 70, paddingHorizontal: 16, paddingBottom: 40, gap: 12, alignItems: 'center' },
  stage: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF0F6' },
  chipOn: { backgroundColor: color.ink },
});
