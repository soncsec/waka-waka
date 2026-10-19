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
  // Each life opens with a scatter phase (M2.2), so the first catch comes later.
  test.setTimeout(90_000);
  await openGame(page, '?seed=7');
  const start = await snapshot(page);
  expect(start).toMatchObject({ phase: 'ready', lives: 3 });
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 60_000 }).toBe('dying');
  await expect.poll(async () => (await snapshot(page)).lives, { timeout: 10_000 }).toBe(2);
  expect((await snapshot(page)).phase).toBe('ready');
});

test('game over, then a key starts a new game without errors', async ({ page }) => {
  test.setTimeout(120_000);
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  await expect
    .poll(async () => (await snapshot(page)).phase, { timeout: 90_000, intervals: [500] })
    .toBe('gameover');
  expect((await snapshot(page)).lives).toBe(0);
  // A key straight away is ignored, so a last swipe can't skip the game-over screen.
  await page.keyboard.press('Space');
  expect((await snapshot(page)).phase).toBe('gameover');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page).catch(() => null))?.phase).toBe('ready');
  const fresh = await snapshot(page);
  expect(fresh).toMatchObject({ lives: 3, score: 0, seed: 7 });
  expect(watched.errors).toEqual([]);
});

test('a cleared maze shows MAZE CLEARED, then the next maze starts with the score kept', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  const first = await snapshot(page);
  expect(first.message).toBe('GET SET!');
  await expect
    .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await page.evaluate(() => window.__game?.skipMaze());
  // The message follows the phase on the next frame.
  await expect.poll(async () => (await snapshot(page)).message).toBe('MAZE CLEARED!');
  const cleared = await snapshot(page);
  expect(cleared).toMatchObject({ phase: 'cleared', dotsLeft: 0 });
  await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(2);
  const next = await snapshot(page);
  expect(next).toMatchObject({
    seed: 7,
    phase: 'ready',
    score: cleared.score,
    lives: cleared.lives,
  });
  expect(next.dotsLeft).toBeGreaterThan(0);
  expect(next.maze.grid).not.toEqual(first.maze.grid);
  expect(watched.errors).toEqual([]);
});

test('opponents start each game scattering to their corners', async ({ page }) => {
  await openGame(page, '?seed=7');
  expect((await snapshot(page)).mode).toBe('scatter');
});

test('a power pellet scares the opponents for a while, without errors', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
  // Power up and look in the same call, so no game step runs in between: an
  // opponent leaving the house a moment later rightly comes out unscared.
  const scared = await page.evaluate(() => {
    window.__game?.powerUp();
    return window.__game?.snapshot() ?? null;
  });
  if (!scared) throw new Error('game scene is not running');
  expect(scared.scaredTime).toBeGreaterThan(0);
  expect(scared.opponents.filter((o) => o.state === 'out').every((o) => o.scared)).toBe(true);
  await expect.poll(async () => (await snapshot(page)).scaredTime, { timeout: 20_000 }).toBe(0);
  expect((await snapshot(page)).opponents.some((o) => o.scared)).toBe(false);
  expect(watched.errors).toEqual([]);
});

test.describe('high score (WW-08)', () => {
  const KEY = 'waka-waka.highScore';

  for (const bad of ['-5', '1e9', '<b>hi</b>', '99999999999999999999']) {
    test(`a tampered stored high score (${bad}) is reset to 0`, async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => {
          if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem(k, v);
            sessionStorage.setItem('seeded', '1');
          }
        },
        [KEY, bad] as const,
      );
      await openGame(page, '?seed=7');
      expect((await snapshot(page)).highScore).toBe(0);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('0');
    });
  }

  test('a valid high score shows, and a better score is saved when the maze is cleared', async ({
    page,
  }) => {
    await page.addInitScript((k) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, '15');
        sessionStorage.setItem('seeded', '1');
      }
    }, KEY);
    await openGame(page, '?seed=7');
    expect((await snapshot(page)).highScore).toBe(15);
    await expect
      .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
      .toBeGreaterThan(15);
    await page.evaluate(() => window.__game?.skipMaze());
    await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(2);
    const score = (await snapshot(page)).score;
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(String(score));
    // Nothing else is stored (PROJECT.md: localStorage holds only the high score).
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([KEY]);
  });
});

test("Murk's Frenzy: a tell, then a burst, then ready again (WW-10)", async ({ page }) => {
  test.setTimeout(60_000);
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
  await page.evaluate(() => window.__game?.primeSpecial(0));
  // Frenzy charges only in chase, so it starts once the first scatter ends.
  const special = async (): Promise<string> => (await snapshot(page)).opponents[0]?.special ?? '';
  await expect.poll(special, { timeout: 30_000, intervals: [50] }).toBe('tell');
  await expect.poll(special, { timeout: 5_000, intervals: [50] }).toBe('active');
  await expect.poll(special, { timeout: 10_000, intervals: [100] }).toBe('ready');
  expect(watched.errors).toEqual([]);
});

test("Bolt's Dash on maze 2: a tell, a dash, then ready again (WW-10)", async ({ page }) => {
  test.setTimeout(90_000);
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('playing');
  await page.evaluate(() => window.__game?.skipMaze());
  await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(2);
  // Bolt leaves the house once the hero has eaten enough or gone idle.
  const bolt = async () => (await snapshot(page)).opponents[2];
  await expect.poll(async () => (await bolt())?.state, { timeout: 30_000 }).toBe('out');
  // Record Bolt's phase every frame: a dash to a nearby junction lasts only a few frames.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { dashSeen: string[] }).dashSeen = seen;
    const tick = (): void => {
      const phase = window.__game?.snapshot()?.opponents[2]?.special;
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__game?.primeSpecial(2);
  });
  const seen = (): Promise<string[]> =>
    page.evaluate(() => (window as unknown as { dashSeen: string[] }).dashSeen);
  await expect.poll(seen, { timeout: 15_000 }).toEqual(expect.arrayContaining(['tell', 'active']));
  await expect.poll(async () => (await seen()).at(-1), { timeout: 10_000 }).toBe('ready');
  const order = await seen();
  expect(order.indexOf('tell')).toBeLessThan(order.indexOf('active'));
  expect(watched.errors).toEqual([]);
});

test("Gnash's Lunge on maze 3: a tell, a jump, a pause, then ready (WW-10)", async ({ page }) => {
  test.setTimeout(90_000);
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  for (const level of [2, 3]) {
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.evaluate(() => window.__game?.skipMaze());
    await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(level);
  }
  await expect
    .poll(async () => (await snapshot(page)).opponents[1]?.state, { timeout: 30_000 })
    .toBe('out');
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { lungeSeen: string[] }).lungeSeen = seen;
    const tick = (): void => {
      const phase = window.__game?.snapshot()?.opponents[1]?.special;
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__game?.primeSpecial(1);
  });
  const seen = (): Promise<string[]> =>
    page.evaluate(() => (window as unknown as { lungeSeen: string[] }).lungeSeen);
  // A lunge either misses (tell, jump, pause) or catches the hero (the life resets it).
  await expect.poll(seen, { timeout: 15_000 }).toEqual(expect.arrayContaining(['tell', 'active']));
  await expect.poll(async () => (await seen()).at(-1), { timeout: 10_000 }).toBe('ready');
  const order = await seen();
  expect(order.indexOf('tell')).toBeLessThan(order.indexOf('active'));
  expect(watched.errors).toEqual([]);
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
  // Ten page loads: allow for a busy machine.
  test.setTimeout(60_000);
  for (const bad of ['-1', '1e5', '99999999999', 'abc', '%3Cscript%3E']) {
    await openGame(page, `?seed=${bad}`);
    const first = (await snapshot(page)).seed;
    await openGame(page, `?seed=${bad}`);
    expect((await snapshot(page)).seed, bad).not.toBe(first);
  }
});
