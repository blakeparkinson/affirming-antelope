import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

/**
 * Voice role-play (Talk mode) on the web build, in Chromium with a fake microphone
 * (`--use-fake-device-for-media-stream`, a steady tone; see playwright.config.ts).
 *
 * The mic is held with a real touch (CDP touchStart → wait → touchEnd), never a
 * script call. The API is route-mocked: `/api/voice/transcribe` answers a canned
 * transcript, `/api/roleplay/turn` a canned reply, and `/api/voice/speak` a tiny MP3
 * per sentence. Everything else off the local server is aborted (offline app).
 *
 * Checks: the transcript becomes the learner's bubble, the reply streams as captions,
 * one speak request per sentence fires in order and each clip actually plays, slide-to-
 * cancel sends nothing, mute keeps captions without speaking, and nothing throws.
 */

const ROLEPLAY = '/roleplay/CL-102';
const TRANSCRIPT = 'It sounds like the pills have been making the days harder.';
const REPLY = 'I hear you. Honestly, the pills make me feel worse, and I am not sure they are worth it. What would you do?';
// how the client cuts REPLY for speech (short "I hear you." waits to join the next sentence)
const SENTENCES = ['I hear you. Honestly, the pills make me feel worse, and I am not sure they are worth it.', 'What would you do?'];

interface Api {
  transcribes: { contentType: string; body: string }[];
  speaks: string[];
  turns: number;
}

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Playwright WebKit has no fake capture device (Chromium-only --use-fake-device-for-media-stream), so getUserMedia cannot succeed headlessly. iOS Safari is checked by hand on the simulator (DESIGN.md › Voice).',
);

const errorsOf = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, baseURL, context }) => {
  await context.grantPermissions(['microphone']);
  const errors: string[] = [];
  errorsOf.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && /Maximum update depth|Minified React error #185/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  // count clips that really started playing (the 30ms unlock clip is a data: URL)
  await page.addInitScript(() => {
    const w = window as unknown as { __plays: string[] };
    w.__plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const src = this.src || this.currentSrc;
      const p = play.call(this);
      p.then(() => w.__plays.push(src.startsWith('data:') ? 'unlock' : 'clip')).catch(() => w.__plays.push('blocked'));
      return p;
    };
  });
  void baseURL;
});

test.afterEach(async ({ page }) => {
  expect(errorsOf.get(page), 'no uncaught errors').toEqual([]);
});

async function mockApi(
  page: Page,
  baseURL: string,
  { slowSecondSentence = 0, transcribe }: { slowSecondSentence?: number; transcribe?: { status: number; body: object } } = {},
): Promise<Api> {
  const origin = new URL(baseURL).origin;
  const api: Api = { transcribes: [], speaks: [], turns: 0 };
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin) return route.continue();
    if (url.pathname === '/api/voice/transcribe') {
      api.transcribes.push({ contentType: req.headers()['content-type'] ?? '', body: req.postData() ?? '' });
      if (transcribe) return route.fulfill({ status: transcribe.status, contentType: 'application/json', body: JSON.stringify(transcribe.body) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: TRANSCRIPT, durationMs: 1500 }) });
    }
    if (url.pathname === '/api/voice/speak') {
      api.speaks.push((req.postDataJSON() as { text: string }).text);
      if (slowSecondSentence && api.speaks.length === 2) await new Promise((r) => setTimeout(r, slowSecondSentence));
      // a 0.6s tone, 2.8KB
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', path: `${test.info().project.testDir}/fixtures/reply.mp3` });
    }
    if (url.pathname === '/api/roleplay/turn') {
      api.turns += 1;
      return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: REPLY });
    }
    return route.abort('internetdisconnected');
  });
  return api;
}

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /try it first|get started/i }).tap();
  await page.getByText('Patients', { exact: true }).tap();
  await page.getByRole('button', { name: /continue/i }).tap();
  await expect(page.getByText(/daily rep/i)).toBeVisible();
}

async function openTalk(page: Page) {
  await onboard(page);
  await page.goto(ROLEPLAY);
  // Talk is opt-in for now: pick it on the brief
  await page.getByRole('radio', { name: /^talk/i }).tap();
  await expect(page.getByRole('radio', { name: /^talk/i })).toBeChecked();
  await page.getByRole('button', { name: /start conversation/i }).tap();
  return page.getByRole('button', { name: /hold to talk/i });
}

async function settledCenter(el: Locator) {
  await expect(el).toBeVisible();
  let last = '';
  for (let i = 0; i < 50; i++) {
    const box = await el.boundingBox();
    const key = JSON.stringify(box);
    if (box && key === last) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    last = key;
    await el.page().waitForTimeout(100);
  }
  throw new Error('the mic never stopped moving');
}

/** A finger on the mic: touchStart, optional slide, hold, touchEnd. */
async function hold(page: Page, cdp: CDPSession, mic: Locator, { ms = 1400, slideUp = 0 } = {}) {
  const { x, y } = await settledCenter(mic);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await expect(page.getByText('Listening…')).toBeVisible();
  const steps = 8;
  for (let i = 1; i <= steps && slideUp; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - (slideUp * i) / steps }] });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('voice role-play', () => {
  test('nothing covers the mic', async ({ page, baseURL }) => {
    await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    const { x, y } = await settledCenter(mic);
    const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('[role="button"]')?.getAttribute('aria-label') ?? 'nothing', [x, y] as const);
    expect(hit).toMatch(/^Hold to talk/);
  });

  test('hold, release: the transcript is your bubble, the reply streams and is spoken in order', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);

    await hold(page, cdp, mic);

    // the take went up as multipart with the contract's fields
    await expect.poll(() => api.transcribes.length).toBe(1);
    const sent = api.transcribes[0];
    expect(sent.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(sent.body).toContain('name="audio"');
    expect(sent.body).toMatch(/Content-Type: audio\/(webm|mp4)/);
    expect(sent.body).toContain('name="scenarioId"');
    expect(sent.body).toContain('CL-102');
    expect(sent.body).toContain('name="durationMs"');
    // real audio from the fake mic, not an empty part
    expect(sent.body.length).toBeGreaterThan(2000);

    // your words, as the learner's bubble; then the reply, through the same turn flow
    await expect(page.getByText(TRANSCRIPT)).toBeVisible();
    expect(api.turns).toBe(1);
    await expect(page.getByText(REPLY)).toBeVisible({ timeout: 15_000 });

    // one speak request per sentence, in order, and every clip played
    await expect.poll(() => api.speaks).toEqual(SENTENCES);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __plays: string[] }).__plays.filter((p) => p === 'clip').length), { timeout: 15_000 }).toBe(SENTENCES.length);
    expect(await page.evaluate(() => (window as unknown as { __plays: string[] }).__plays.includes('blocked'))).toBe(false);

    // and back to listening for the next turn
    await expect(page.getByText('Hold to talk', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('holding the mic while they talk cuts in: playback stops, the queue clears, you are recording', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!, { slowSecondSentence: 4000 });
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);
    const plays = () => page.evaluate(() => (window as unknown as { __plays: string[] }).__plays.filter((p) => p === 'clip').length);

    await hold(page, cdp, mic);
    await expect(page.getByText(/is talking\. Hold to cut in\./)).toBeVisible({ timeout: 15_000 });
    await expect.poll(plays).toBe(1);
    // the second sentence is still on its way: cut in now
    await hold(page, cdp, mic, { ms: 900 });
    await expect.poll(() => api.transcribes.length).toBe(2);
    await expect(page.getByText(TRANSCRIPT)).toHaveCount(2);
    await page.waitForTimeout(4500);
    // the interrupted sentence never played; the new reply's sentences did
    expect(api.speaks.slice(0, 2)).toEqual(SENTENCES);
    expect(await page.evaluate(() => (window as unknown as { __plays: string[] }).__plays.includes('blocked'))).toBe(false);
    expect(api.turns).toBe(2);
  });

  test('slide up to cancel: nothing is sent', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);

    await hold(page, cdp, mic, { ms: 600, slideUp: 140 });
    await expect(page.getByText('Hold to talk', { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    expect(api.transcribes).toHaveLength(0);
    expect(api.turns).toBe(0);
  });

  test('mute voice: captions keep coming, nothing is spoken', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);
    await page.getByRole('button', { name: 'Mute voice' }).tap();
    await expect(page.getByRole('button', { name: 'Unmute voice' })).toBeVisible();

    await hold(page, cdp, mic);
    await expect(page.getByText(TRANSCRIPT)).toBeVisible();
    await expect(page.getByText(REPLY)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    expect(api.speaks).toHaveLength(0);
  });

  test('nothing intelligible (422 no_speech): a gentle line, and the mic is ready again', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!, { transcribe: { status: 422, body: { error: 'no_speech' } } });
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);
    await hold(page, cdp, mic, { ms: 900 });
    await expect(page.getByText('Didn’t catch that. Hold and try again.')).toBeVisible();
    expect(api.turns).toBe(0);
    await expect(mic).toBeVisible();
  });

  test('voice off on the server (503 voice_unavailable): falls back to Type with a one-line note', async ({ page, baseURL }) => {
    await mockApi(page, baseURL!, { transcribe: { status: 503, body: { error: 'voice_unavailable' } } });
    const mic = await openTalk(page);
    const cdp = await page.context().newCDPSession(page);
    await hold(page, cdp, mic, { ms: 900 });
    await expect(page.getByText('Voice is taking a break, so let’s type for now.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /your reply to/i })).toBeVisible();
  });

  test('mic permission denied: falls back to Type, and Type is remembered', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true });
    });
    await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    // the site permission reads "granted", so the refusal only shows when the mic actually opens
    const { x, y } = await settledCenter(mic);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByText(/didn’t share your mic, so let’s type/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: /your reply to/i })).toBeVisible();
    await page.goto(ROLEPLAY);
    await expect(page.getByRole('radio', { name: /^type/i })).toBeChecked();
  });

  test('keyboard: holding Space on the focused mic talks, letting go sends', async ({ page, baseURL }) => {
    const api = await mockApi(page, baseURL!);
    const mic = await openTalk(page);
    await settledCenter(mic);
    await mic.focus();
    await page.keyboard.down(' ');
    await expect(page.getByText('Listening…')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.keyboard.up(' ');
    await expect(page.getByText(TRANSCRIPT)).toBeVisible();
    expect(api.transcribes).toHaveLength(1);
  });
});
