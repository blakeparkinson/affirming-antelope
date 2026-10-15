import { noNotifier } from './notifyNone';

/**
 * Fallback only (Metro picks `.native.ts` on iOS/Android; TypeScript resolves this file).
 * Also what web gets: no local notifications, so the reminder offer and the Me row hide.
 */
export const notifier = noNotifier;
