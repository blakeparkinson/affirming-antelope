import { expect, test, type Page } from '@playwright/test';

/**
 * Home stays mounted under the tabs, so it has to notice the calendar moving on its own:
 * at midnight while it's open (a Monday starts a new week) and when the app comes back
 * on a later day (a missed day spends a freeze, and Home says so). Offline, with the
 * page clock driven by Playwright.
 */

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort('internetdisconnected')));
});

/** Sunday 18 October 2026, two minutes to midnight (local). */
const SUNDAY_LATE = new Date(2026, 9, 18, 23, 58);

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /try it first|get started/i }).tap();
  await page.getByRole('button', { name: /continue/i }).tap();
  await expect(page.getByText(/daily rep/i)).toBeVisible();
}

/** Rewrite the persisted learner state, then reload so the store hydrates from it. */
async function seed(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((p) => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key) ?? '';
      if (!raw.includes('"activePathwayId"')) continue;
      const doc = JSON.parse(raw);
      Object.assign(doc.state, p);
      localStorage.setItem(key, JSON.stringify(doc));
    }
  }, patch);
  await page.reload();
}

/** The app went to the background and came back (AppState 'active' on web). */
async function backgroundAndReturn(page: Page) {
  await page.evaluate(() => {
    const set = (v: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set('hidden');
    set('visible');
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: SUNDAY_LATE });
  await onboard(page);
  // practised the last three days, three times this week (the goal), one freeze held
  await seed(page, {
    streak: { days: 3, lastPracticeDay: '2026-10-18' },
    weekStart: '2026-10-12',
    weekDays: [false, false, false, false, true, true, true],
    weeklyGoal: { target: 3, done: 3, hitCount: 1 },
    freezes: { earnedDays: [], usedDays: [] },
    freezeNoticeSeen: null,
  });
  await expect(page.getByLabel('3-day streak')).toBeVisible();
  await expect(page.getByLabel(/^Weekly goal: 3 of 3/)).toBeVisible();
});

test('a new week starts at midnight while Home is open', async ({ page }) => {
  await page.clock.fastForward('03:00');
  await expect(page.getByLabel(/^Weekly goal: 0 of 3/)).toBeVisible();
  // practised yesterday: the streak carries over
  await expect(page.getByLabel('3-day streak')).toBeVisible();
});

test('back on a later day, Home spends the freeze and says so', async ({ page }) => {
  // away all of Monday, back Tuesday morning
  await page.clock.setSystemTime(new Date(2026, 9, 20, 8, 0));
  await backgroundAndReturn(page);
  await expect(page.getByText(/a streak freeze covered yesterday/i)).toBeVisible();
  await expect(page.getByLabel('3-day streak')).toBeVisible();
  await expect(page.getByLabel(/^Weekly goal: 0 of 3/)).toBeVisible();
});
