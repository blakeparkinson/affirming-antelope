import type { ReminderKind } from '@antelope/core';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { Notifier, NotifyPermission, ReminderOpen } from './notifyTypes';

/** iOS and Android: local notifications scheduled on the device (expo-notifications). */

const CHANNEL = 'reminders';

// A reminder that fires while the app is open says nothing: they're already here.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let channelReady: Promise<unknown> | null = null;
function ensureChannel(): Promise<unknown> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Practice reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
  return channelReady;
}

function toPermission(p: Notifications.NotificationPermissionsStatus): NotifyPermission {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

function toOpen(r: Notifications.NotificationResponse): ReminderOpen {
  const data = r.notification.request.content.data as { kind?: ReminderKind } | undefined;
  return { kind: data?.kind, id: `${r.notification.request.identifier}@${r.notification.date}` };
}

export const notifier: Notifier = {
  supported: true,
  permission: async () => toPermission(await Notifications.getPermissionsAsync()),
  request: async () => {
    const now = await Notifications.getPermissionsAsync();
    if (toPermission(now) !== 'undetermined') return toPermission(now);
    // the channel has to exist before Android 13+ will show the prompt
    await ensureChannel();
    return toPermission(await Notifications.requestPermissionsAsync());
  },
  replaceAll: async (plan) => {
    await ensureChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { kind: r.kind } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
  },
  onOpen: (listener) => {
    const seen = new Set<string>();
    const emit = (r: Notifications.NotificationResponse | null) => {
      if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const open = toOpen(r);
      if (seen.has(open.id)) return;
      seen.add(open.id);
      listener(open);
    };
    // the tap that launched the app, then any while it runs
    emit(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(emit);
    return () => sub.remove();
  },
  openSettings: () => {
    Linking.openSettings().catch(() => {});
  },
};
