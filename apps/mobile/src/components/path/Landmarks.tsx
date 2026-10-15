import { memo, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { riveAvailable } from '@/components/mascot/riveAvailable';
import type { LandmarkPlacement, Motif } from './geometry';
import { LANDMARK_ART, type LandmarkId } from './landmarks.generated';
import { LandmarkStill, type LandmarkProps } from './LandmarkStill';

/**
 * Landmark drawing: Rive where the runtime is linked (dev client, release builds), the still
 * PNG on web and in Expo Go. RiveLandmark is required lazily: it needs the native module.
 */
const Landmark: ComponentType<LandmarkProps> = riveAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./RiveLandmark') as typeof import('./RiveLandmark')).RiveLandmark
  : LandmarkStill;

/**
 * Which landmark goes in which gap (the gap after week `gap + 1`), per track. The savanna has
 * all four; the wetland keeps to the watering hole and the rocks until it has its own art.
 */
export function landmarkPlan(motif: Motif, weeks: number): { gap: number; id: LandmarkId }[] {
  const ids: LandmarkId[] = motif === 'savanna' ? ['baobab', 'kopje', 'acacia', 'pond'] : ['pond', 'kopje'];
  // spread evenly from the gap after week 2 to the one three weeks before the end (the last
  // stretch leads into the finish meadow, which has its own scene)
  const last = weeks - 3;
  if (last < 1) return [];
  const n = Math.min(ids.length, last);
  return ids.slice(0, n).map((id, i) => ({ gap: n === 1 ? 1 : Math.round(1 + (i * (last - 1)) / (n - 1)), id }));
}

export { LANDMARK_ART };

/** The landmarks, in content space between the landscape and the trail. Decoration only. */
export const Landmarks = memo(function Landmarks({ items, paused }: { items: LandmarkPlacement<LandmarkId>[]; paused: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((l) => (
        <Landmark
          key={`${l.id}-${l.ground}`}
          id={l.id}
          paused={paused}
          style={{ position: 'absolute', left: l.x, top: l.ground - (l.height * LANDMARK_ART[l.id].ground) / LANDMARK_ART[l.id].height, width: l.width, height: l.height }}
        />
      ))}
    </View>
  );
});
