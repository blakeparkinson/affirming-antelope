import type { Notifier } from './notifyTypes';

/**
 * Fallback only (Metro picks `.native.ts` on iOS/Android; TypeScript resolves this file).
 * Also what web gets: no local notifications, so the reminder offer and the Me row hide.
 */
export const notifier: Notifier = {
  supported: false,
  permission: async () => 'unsupported',
  request: async () => 'unsupported',
  replaceAll: async () => {},
  onOpen: () => () => {},
  openSettings: () => {},
};
