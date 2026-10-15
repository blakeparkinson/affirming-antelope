import type { Notifier } from './notifyTypes';

/** No local notifications here, so the reminder offer and the Me row hide. */
export const noNotifier: Notifier = {
  supported: false,
  permission: async () => 'unsupported',
  request: async () => 'unsupported',
  replaceAll: async () => {},
  onOpen: () => () => {},
  openSettings: () => {},
};
