import type { ReactNode } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * The full-screen layer a moment (streak milestone, level-up, weekly recap) plays on.
 *
 * On iOS a React Native <Modal> presents from the root view controller, and that root is
 * already presenting the practice session (a native transparent modal), so UIKit refuses
 * it: the moment's queue entry reads "showing" while nothing is on screen and every later
 * moment waits behind it. FullWindowOverlay draws in its own window above every native
 * modal instead. Android and web keep <Modal>, which already sits above everything there.
 * The moment owns its fade; nothing here animates. Input below is blocked while it's up.
 */
export function MomentOverlay({ onRequestClose, children }: { onRequestClose: () => void; children: ReactNode }) {
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
            {children}
          </View>
        </GestureHandlerRootView>
      </FullWindowOverlay>
    );
  }
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}
