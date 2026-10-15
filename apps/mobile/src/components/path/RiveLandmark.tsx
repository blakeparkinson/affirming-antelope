// Only import this module when `riveAvailable` is true: @rive-app/react-native needs its native
// module at load time. Landmarks.tsx takes care of that.
import { DataBindMode, Fit, RiveView, useRiveFile, type RiveViewRef } from '@rive-app/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { riveCall } from '@/lib/riveCall';
import { LANDMARK_STATE_MACHINE, type LandmarkId } from './landmarks.generated';
import { LandmarkStill, type LandmarkProps } from './LandmarkStill';

const FILES: Record<LandmarkId, number> = {
  baobab: require('../../../assets/rive/landmarks/baobab.riv'),
  kopje: require('../../../assets/rive/landmarks/kopje.riv'),
  pond: require('../../../assets/rive/landmarks/pond.riv'),
  acacia: require('../../../assets/rive/landmarks/acacia.riv'),
};

/**
 * A landmark's idle loop in Rive (leaves sway, water glints, the bird pecks). The still drawing
 * holds the spot until the view is ready, and stays if the file fails to load.
 */
export function RiveLandmark(props: LandmarkProps) {
  const { id, paused, style } = props;
  const { riveFile, error } = useRiveFile(FILES[id]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const view = useRef<RiveViewRef | null>(null);

  const onHybridRef = useCallback((r: RiveViewRef | null) => {
    view.current = r;
    if (!r) return;
    riveCall(() => r.awaitViewReady())
      .then((ok) => setReady(ok))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v || !ready) return;
    if (paused) riveCall(() => v.pause()).catch(() => {});
    else riveCall(() => v.play()).catch(() => {});
  }, [paused, ready]);

  if (error || failed) return <LandmarkStill {...props} />;
  return (
    <View style={style} pointerEvents="none">
      {!ready ? <LandmarkStill {...props} style={StyleSheet.absoluteFill} /> : null}
      {riveFile ? (
        <RiveView
          file={riveFile}
          stateMachineName={LANDMARK_STATE_MACHINE}
          // no view model in these files: skip the default binding (it logs an error otherwise)
          dataBind={DataBindMode.None}
          autoPlay={!paused}
          fit={Fit.Contain}
          hybridRef={{ f: onHybridRef }}
          onError={() => setFailed(true)}
          style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
        />
      ) : null}
    </View>
  );
}
