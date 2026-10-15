import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LandmarkId } from './landmarks.generated';

/** The landmark's rest pose as a PNG (rendered by scripts/landmarks/build.mjs from the .riv). */
export const LANDMARK_STILLS: Record<LandmarkId, number> = {
  baobab: require('../../../assets/images/landmarks/baobab.png'),
  kopje: require('../../../assets/images/landmarks/kopje.png'),
  pond: require('../../../assets/images/landmarks/pond.png'),
  acacia: require('../../../assets/images/landmarks/acacia.png'),
};

export interface LandmarkProps {
  id: LandmarkId;
  /** Hold the idle loop (reduced motion, screen out of focus, app in the background). */
  paused: boolean;
  style: StyleProp<ViewStyle>;
}

/** Web and Expo Go (no Rive runtime): the still drawing. */
export function LandmarkStill({ id, style }: LandmarkProps) {
  return (
    <View style={style} pointerEvents="none">
      <Image source={LANDMARK_STILLS[id]} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
    </View>
  );
}
