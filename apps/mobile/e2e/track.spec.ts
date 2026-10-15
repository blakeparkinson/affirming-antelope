import { expect, test, type Page } from '@playwright/test';

/**
 * The onboarding track step: MI for Leaders ("Your team") leads and is preselected, and
 * a clinician launch hint (`?src=audience_clinicians`, or a clinical guide drill) is the
 * only thing that preselects Patients. Offline, like the other e2e tests.
 */

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort('internetdisconnected')));
});

async function toTrackStep(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: /try it first|get started/i }).tap();
  await expect(page.getByRole('radio')).toHaveCount(2);
}

/** The track the persisted learner state says is active. */
async function activePathway(page: Page) {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const m = /"activePathwayId":"([^"]+)"/.exec(localStorage.getItem(key) ?? '');
      if (m) return m[1];
    }
    return null;
  });
}

test('with no hint, Your team comes first and is preselected', async ({ page }) => {
  await toTrackStep(page, '/?src=hero');
  const cards = page.getByRole('radio');
  await expect(cards.first()).toHaveAccessibleName(/^Your team/);
  await expect(cards.nth(1)).toHaveAccessibleName(/^Patients/);
  await expect(page.getByRole('radio', { name: /^Your team/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^Patients/ })).not.toBeChecked();
  await page.getByRole('button', { name: /continue/i }).tap();
  await expect(page.getByText(/daily rep/i)).toBeVisible();
  expect(await activePathway(page)).toBe('mi-for-leaders');
});

test('a clinicians launch hint preselects Patients, and Your team is still one tap away', async ({ page }) => {
  await toTrackStep(page, '/?src=audience_clinicians');
  await expect(page.getByRole('radio').first()).toHaveAccessibleName(/^Your team/);
  await expect(page.getByRole('radio', { name: /^Patients/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^Your team/ })).not.toBeChecked();
  await page.getByRole('radio', { name: /^Your team/ }).tap();
  await expect(page.getByRole('radio', { name: /^Your team/ })).toBeChecked();
});

test('a clinicians launch hint carries through to the chosen track', async ({ page }) => {
  await toTrackStep(page, '/?src=audience_clinicians');
  await page.getByRole('button', { name: /continue/i }).tap();
  await expect(page.getByText(/daily rep/i)).toBeVisible();
  expect(await activePathway(page)).toBe('mi-for-clinicians');
});

test('a clinical guide drill preselects Patients', async ({ page }) => {
  await toTrackStep(page, '/drill/drill-cl-oars-01?src=guide_what-is-motivational-interviewing');
  await expect(page.getByRole('radio', { name: /^Patients/ })).toBeChecked();
});

test('a workplace guide drill keeps Your team preselected', async ({ page }) => {
  await toTrackStep(page, '/drill/drill-oars-01?src=guide_what-is-motivational-interviewing');
  await expect(page.getByRole('radio', { name: /^Your team/ })).toBeChecked();
});
