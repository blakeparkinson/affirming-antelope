import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The practice composer on the web build, driven the way a person on a phone uses
 * it: a real tap on the field (never focus() or fill()), then key-by-key typing.
 *
 * Guards the two bugs that shipped because earlier checks focused the field from
 * script: an invisible mirror Text covering the <textarea> so taps never reached
 * it, and an effect that set state on every keystroke ("Maximum update depth
 * exceeded", React #185) and dropped characters.
 *
 * No backend: every request that isn't to the local static server is aborted, so
 * Supabase and the AI API are unreachable and the app has to work offline.
 */

const DRILL = '/drill/drill-cl-oars-04';
const ROLEPLAY = '/roleplay/CL-102';
// 120 characters, mixed case and punctuation, like a real reflection
const SENTENCE = 'So the pills seemed to hurt more than help, and you would rather feel okay today than worry about numbers.';
const LINE = (SENTENCE + ' Got it, thanks.').slice(0, 120);

const errorsOf = new WeakMap<Page, string[]>();

// every test: no network beyond the local server, and no uncaught errors
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort('internetdisconnected')));
  const errors: string[] = [];
  errorsOf.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && /Maximum update depth|Minified React error #185/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(errorsOf.get(page), 'no uncaught errors (React #185 is "Maximum update depth exceeded")').toEqual([]);
});

/** First run, offline: Try it first, then the track step. */
async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /try it first|get started/i }).tap();
  await page.getByText('Patients', { exact: true }).tap();
  await page.getByRole('button', { name: /continue/i }).tap();
  await expect(page.getByText(/daily rep/i)).toBeVisible();
}

/** The field's centre once the screen's entrance has settled (so the point doesn't move under the tap). */
async function center(field: Locator) {
  await expect(field).toBeVisible();
  let last = '';
  for (let i = 0; i < 50; i++) {
    const box = await field.boundingBox();
    const key = JSON.stringify(box);
    if (box && key === last) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    last = key;
    await field.page().waitForTimeout(100);
  }
  throw new Error('the composer never stopped moving');
}

/** The top element under the field's centre is the textarea itself (nothing invisible covering it). */
async function expectHitTarget(page: Page, field: Locator) {
  const { x, y } = await center(field);
  const hit = await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return el ? `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}` : 'nothing';
  }, [x, y] as const);
  expect(hit, 'element at the composer centre').toBe(`textarea[${await field.getAttribute('aria-label')}]`);
}

/** A real touch at the field's centre focuses the textarea. */
async function tapToFocus(page: Page, field: Locator) {
  const { x, y } = await center(field);
  await page.touchscreen.tap(x, y);
  await expect
    .poll(() => page.evaluate(() => `${document.activeElement?.tagName.toLowerCase()}:${document.activeElement?.getAttribute('aria-label')}`))
    .toBe(`textarea:${await field.getAttribute('aria-label')}`);
}

async function typeAndCheck(page: Page, field: Locator, delay: number) {
  expect(LINE).toHaveLength(120);
  await page.keyboard.type(LINE, { delay });
  await expect(field).toHaveValue(LINE);
  // still alive: one more key lands too
  await page.keyboard.type('!');
  await expect(field).toHaveValue(`${LINE}!`);
}

async function openDrill(page: Page) {
  await onboard(page);
  await page.goto(DRILL);
  return page.getByRole('textbox', { name: /your response to/i });
}

async function openRoleplay(page: Page) {
  await onboard(page);
  await page.goto(ROLEPLAY);
  // Type mode (the default; voice has its own spec)
  await page.getByRole('radio', { name: /^type/i }).tap();
  await expect(page.getByRole('radio', { name: /^type/i })).toBeChecked();
  await page.getByRole('button', { name: /start conversation/i }).tap();
  return page.getByRole('textbox', { name: /your reply to/i });
}

test.describe('drill composer', () => {
  test('nothing covers the field', async ({ page }) => {
    await expectHitTarget(page, await openDrill(page));
  });

  test('a tap focuses the field', async ({ page }) => {
    await tapToFocus(page, await openDrill(page));
  });

  for (const delay of [35, 0]) {
    test(`typing 120 characters keeps every one (${delay}ms between keys)`, async ({ page }) => {
      const field = await openDrill(page);
      await tapToFocus(page, field);
      await typeAndCheck(page, field, delay);
    });
  }
});

test.describe('role-play composer', () => {
  test('nothing covers the field, and a tap focuses it', async ({ page }) => {
    const field = await openRoleplay(page);
    await expectHitTarget(page, field);
    await tapToFocus(page, field);
  });

  for (const delay of [35, 0]) {
    test(`typing 120 characters keeps every one (${delay}ms between keys)`, async ({ page }) => {
      const field = await openRoleplay(page);
      await tapToFocus(page, field);
      await typeAndCheck(page, field, delay);
    });
  }
});
