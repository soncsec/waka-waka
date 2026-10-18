import { expect, test, type Page } from '@playwright/test';
import type { GameSnapshot } from '../../src/scenes/GameScene';

/** Records console errors, uncaught exceptions and requests to other hosts. */
function watchPage(page: Page): { errors: string[]; foreignRequests: string[] } {
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') {
      foreignRequests.push(req.url());
    }
  });
  return { errors, foreignRequests };
}

async function snapshot(page: Page): Promise<GameSnapshot> {
  const snap = await page.evaluate(() => window.__game?.snapshot() ?? null);
  if (!snap) throw new Error('game scene is not running');
  return snap;
}

async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Game');
}

test('boots with no console errors and no third-party requests', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('the hero moves on its own and eats dots for points', async ({ page }) => {
  await openGame(page, '?seed=7');
  const start = await snapshot(page);
  // Play starts after the READY pause.
  await expect
    .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const later = await snapshot(page);
  expect(later.dotsLeft).toBeLessThan(start.dotsLeft);
  expect(later.score % 10).toBe(0);
});

test('Murk catches a hero left alone, and a life is lost', async ({ page }) => {
  await openGame(page, '?seed=7');
  const start = await snapshot(page);
  expect(start).toMatchObject({ phase: 'ready', lives: 3 });
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 30_000 }).toBe('dying');
  await expect.poll(async () => (await snapshot(page)).lives, { timeout: 10_000 }).toBe(2);
  expect((await snapshot(page)).phase).toBe('ready');
});

test('arrow keys and WASD steer the hero', async ({ page }) => {
  await openGame(page, '?seed=7');
  // The hero starts heading left; the opposite direction is taken at once.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).hero.dir, { timeout: 15_000 }).toBe('right');
  await page.keyboard.press('KeyA');
  await expect.poll(async () => (await snapshot(page)).hero.dir, { timeout: 15_000 }).toBe('left');
});

/** Drags across the canvas with the mouse, like a swipe. */
async function swipe(page: Page, dx: number, dy: number): Promise<void> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

test('a swipe steers the hero', async ({ page }) => {
  await openGame(page, '?seed=7');
  await swipe(page, 80, 0);
  await expect.poll(async () => (await snapshot(page)).hero.dir, { timeout: 15_000 }).toBe('right');
  await swipe(page, -80, 10);
  await expect.poll(async () => (await snapshot(page)).hero.dir, { timeout: 15_000 }).toBe('left');
});

test.describe('on a touchscreen', () => {
  // Like a phone or tablet: the browser reports touch support, so Phaser listens for touch events.
  test.use({ hasTouch: true });

  test('a touchscreen swipe steers the hero', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'touch events are sent through Chromium DevTools');
    await openGame(page, '?seed=7');
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number): Promise<unknown> =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }],
      });
    await touch('touchStart', x);
    for (let i = 1; i <= 5; i++) await touch('touchMove', x + i * 16);
    await touch('touchEnd', x);
    await expect
      .poll(async () => (await snapshot(page)).hero.dir, { timeout: 15_000 })
      .toBe('right');
    expect(
      await page.evaluate(
        () => getComputedStyle(document.getElementById('game') as HTMLElement).touchAction,
      ),
    ).toBe('none');
  });
});

test('?seed= in the URL sets the random seed', async ({ page }) => {
  await openGame(page, '?seed=42');
  expect((await snapshot(page)).seed).toBe(42);
});

test('draws a 384 x 464 maze at a whole-number zoom', async ({ page }) => {
  await openGame(page, '?seed=7');
  const snap = await snapshot(page);
  expect(snap.screen).toMatchObject({ width: 384, height: 464 });
  expect(Number.isInteger(snap.screen.zoom) && snap.screen.zoom >= 1).toBe(true);
  expect(snap.level).toBe(1);
  expect(snap.maze.grid).toHaveLength(27);
  expect(snap.maze.usedFallback).toBe(false);
  const box = await page.locator('#game canvas').boundingBox();
  expect(box?.width).toBe(384 * snap.screen.zoom);
  expect(box?.height).toBe(464 * snap.screen.zoom);
});

test('the same ?seed= gives the same maze; no seed gives a new maze each run', async ({ page }) => {
  await openGame(page, '?seed=2026');
  const first = (await snapshot(page)).maze.grid;
  await openGame(page, '?seed=2026');
  expect((await snapshot(page)).maze.grid).toEqual(first);

  await openGame(page);
  const a = await snapshot(page);
  await openGame(page);
  const b = await snapshot(page);
  expect(a.seed).not.toBe(b.seed);
  expect(a.maze.grid).not.toEqual(b.maze.grid);
});

test('an invalid ?seed= is ignored and a random seed is used', async ({ page }) => {
  for (const bad of ['-1', '1e5', '99999999999', 'abc', '%3Cscript%3E']) {
    await openGame(page, `?seed=${bad}`);
    const first = (await snapshot(page)).seed;
    await openGame(page, `?seed=${bad}`);
    expect((await snapshot(page)).seed, bad).not.toBe(first);
  }
});
