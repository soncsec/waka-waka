import { expect, test, type Page } from '@playwright/test';
import type { GameSnapshot } from '../../src/scenes/GameScene';
import { startFromTitle } from './title';

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

/** Loads the page and starts a game from the title screen. */
async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await startFromTitle(page);
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

test.describe('the bonus battery (M3.3)', () => {
  test('shows on the start spot during play, then goes after its time', async ({ page }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    // Let the hero move off the start spot first.
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__game?.showBonus());
    await expect.poll(async () => (await snapshot(page)).bonus.showing).toBe(true);
    await expect
      .poll(async () => (await snapshot(page)).bonus.showing, { timeout: 20_000 })
      .toBe(false);
    expect(watched.errors).toEqual([]);
  });

  test('eating it scores the maze 1 points and pops them up', async ({ page }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    // Out before play starts, so the hero eats it with its first step off the start spot.
    await page.evaluate(() => window.__game?.showBonus());
    await expect
      .poll(async () => (await snapshot(page)).bonus.popup, { timeout: 15_000 })
      .toBe('250');
    const snap = await snapshot(page);
    expect(snap.bonus.showing).toBe(false);
    expect(snap.score).toBeGreaterThanOrEqual(250);
    await expect.poll(async () => (await snapshot(page)).bonus.popup).toBeNull();
    expect(watched.errors).toEqual([]);
  });
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
  // Record Bolt's phase every simulation step: a dash to a nearby junction lasts only a few
  // steps, and a busy machine runs several steps per drawn frame.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { dashSeen: string[] }).dashSeen = seen;
    window.__game?.onStep(() => {
      const phase = window.__game?.snapshot()?.opponents[2]?.special;
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
    });
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
    window.__game?.onStep(() => {
      const phase = window.__game?.snapshot()?.opponents[1]?.special;
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
    });
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

test("Wisp's Phase on maze 5: see-through, through a wall, then ready (WW-10)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const watched = watchPage(page);
  await openGame(page, '?seed=7');
  for (const level of [2, 3, 4, 5]) {
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.evaluate(() => window.__game?.skipMaze());
    await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(level);
  }
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { phaseSeen: string[] }).phaseSeen = seen;
    const tick = (): void => {
      const snap = window.__game?.snapshot();
      const wisp = snap?.opponents[3];
      const phase = wisp?.special;
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
      if (snap?.phase === 'playing' && wisp && !seen.includes('active')) {
        // Keep the hero safe until Wisp has phased: scare the others while Wisp is
        // still in the house (so Wisp itself is never scared)...
        if (wisp.state !== 'out' && snap.scaredTime === 0) window.__game?.powerUp();
        // ...and keep Phase primed once Wisp is out (a lost life would reset it).
        if (wisp.state === 'out' && !wisp.scared) window.__game?.primeSpecial(3);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const seen = (): Promise<string[]> =>
    page.evaluate(() => (window as unknown as { phaseSeen: string[] }).phaseSeen);
  await expect.poll(seen, { timeout: 60_000 }).toEqual(expect.arrayContaining(['tell', 'active']));
  await expect.poll(async () => (await seen()).at(-1), { timeout: 10_000 }).toBe('ready');
  const order = await seen();
  expect(order.indexOf('tell')).toBeLessThan(order.indexOf('active'));
  expect(watched.errors).toEqual([]);
});

test.describe('pause (M4.4)', () => {
  test('P pauses and Esc carries on; nothing moves while paused', async ({ page }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.keyboard.press('KeyP');
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    const frozen = await snapshot(page);
    await page.waitForTimeout(1000);
    const later = await snapshot(page);
    expect(later.hero).toEqual(frozen.hero);
    expect(later.opponents).toEqual(frozen.opponents);
    expect(later.score).toBe(frozen.score);
    // A direction key while paused is ignored.
    await page.keyboard.press('ArrowUp');
    expect((await snapshot(page)).wanted).toBe(frozen.wanted);

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
    await expect
      .poll(async () => (await snapshot(page)).opponents, { timeout: 5_000 })
      .not.toEqual(frozen.opponents);
    expect(watched.errors).toEqual([]);
  });

  test('P then Esc within one frame pauses and carries on, once each', async ({ page }) => {
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    // Fire the key events back to back, so they all land before the next frame.
    const paused = await page.evaluate(() => {
      const fire = (type: string, code: string, keyCode: number): void => {
        const e = new KeyboardEvent(type, { code, key: code, bubbles: true });
        Object.defineProperty(e, 'keyCode', { get: () => keyCode });
        window.dispatchEvent(e);
      };
      fire('keydown', 'KeyP', 80);
      fire('keyup', 'KeyP', 80);
      const afterP = window.__game?.snapshot()?.paused ?? null;
      fire('keydown', 'Escape', 27);
      fire('keyup', 'Escape', 27);
      return [afterP, window.__game?.snapshot()?.paused ?? null];
    });
    expect(paused).toEqual([true, false]);
  });

  test('losing focus pauses, and a tap carries on', async ({ page }) => {
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    const frozen = await snapshot(page);
    await page.locator('#game canvas').click();
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
    // The tap only resumed: it did not steer.
    expect((await snapshot(page)).wanted).toBe(frozen.wanted);
  });
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

test.describe('the joystick (M4.1)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Sends pointer events of `type` ('touch' or 'mouse') to the page around the canvas. */
  async function stick(
    page: Page,
    pointerType: string,
    moves: [number, number][],
  ): Promise<{ shown: boolean[]; wanted: (string | null)[] }> {
    return page.evaluate(
      ({ pointerType, moves }) => {
        const root = document.getElementById('game') as HTMLElement;
        const base = document.querySelector('.joystick') as HTMLElement;
        const fire = (type: string, x: number, y: number): void => {
          root.dispatchEvent(
            new PointerEvent(type, {
              pointerType,
              pointerId: 7,
              clientX: x,
              clientY: y,
              bubbles: true,
              cancelable: true,
            }),
          );
        };
        const shown: boolean[] = [];
        const wanted: (string | null)[] = [];
        const [start = [0, 0], ...rest] = moves;
        fire('pointerdown', start[0], start[1]);
        shown.push(getComputedStyle(base).display !== 'none');
        for (const [x, y] of rest) {
          fire('pointermove', x, y);
          wanted.push(window.__game?.snapshot()?.wanted ?? null);
        }
        fire('pointerup', start[0], start[1]);
        shown.push(getComputedStyle(base).display !== 'none');
        return { shown, wanted };
      },
      { pointerType, moves },
    );
  }

  test('a thumb below the maze shows the stick and steers; lifting it hides the stick', async ({
    page,
  }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const x = 195;
    const y = Math.round((box.y + box.height + 844) / 2);
    expect(y).toBeGreaterThan(box.y + box.height);
    const result = await stick(page, 'touch', [
      [x, y],
      [x + 4, y], // inside the dead zone: no turn
      [x, y - 30],
      [x + 30, y],
    ]);
    expect(result.shown).toEqual([true, false]);
    expect(result.wanted[1]).toBe('up');
    expect(result.wanted[2]).toBe('right');
    expect(watched.errors).toEqual([]);
  });

  test('a mouse never shows the stick', async ({ page }) => {
    await openGame(page, '?seed=7');
    const result = await stick(page, 'mouse', [
      [195, 800],
      [195, 760],
    ]);
    expect(result.shown).toEqual([false, false]);
  });

  test('touching the stick area while paused carries on without steering', async ({ page }) => {
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.keyboard.press('KeyP');
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    const before = (await snapshot(page)).wanted;
    const result = await stick(page, 'touch', [
      [195, 800],
      [195, 760],
    ]);
    const after = await snapshot(page);
    expect(after.paused).toBe(false);
    expect(result.wanted[0]).toBe(before);
  });
});

test.describe('a phone held landscape (M4.2)', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('shows the turn-upright prompt and pauses; upright, a tap carries on', async ({ page }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    const prompt = page.locator('.rotate-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText('TURN YOUR PHONE UPRIGHT TO PLAY');
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    // Paused during GET SET!, so play doesn't start behind the prompt.
    await page.waitForTimeout(2500);
    expect((await snapshot(page)).phase).toBe('ready');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(prompt).toBeHidden();
    expect((await snapshot(page)).paused).toBe(true);
    await page.locator('#game canvas').click();
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 10_000 })
      .toBe('playing');

    // Turned sideways again mid-game: the prompt returns and the game pauses.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(prompt).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    expect(watched.errors).toEqual([]);
  });

  test('a tablet held landscape plays without the prompt', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openGame(page, '?seed=7');
    await expect(page.locator('.rotate-prompt')).toBeHidden();
    expect((await snapshot(page)).paused).toBe(false);
  });
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
  // Ten page loads, each through the title screen: allow for a busy machine.
  test.setTimeout(120_000);
  for (const bad of ['-1', '1e5', '99999999999', 'abc', '%3Cscript%3E']) {
    await openGame(page, `?seed=${bad}`);
    const first = (await snapshot(page)).seed;
    await openGame(page, `?seed=${bad}`);
    expect((await snapshot(page)).seed, bad).not.toBe(first);
  }
});

test.describe('title, help and game-over screens (M4.3)', () => {
  const title = (page: Page) => page.evaluate(() => window.__game?.title() ?? null);

  test('the title shows the cast, then the help page, and a key starts a game', async ({
    page,
  }) => {
    const watched = watchPage(page);
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.page, { timeout: 15_000 }).toBe('cast');
    // The cast appears one row at a time.
    expect((await title(page))?.castShown).toBeLessThan(5);
    await expect.poll(async () => (await title(page))?.castShown, { timeout: 15_000 }).toBe(5);
    // The pages take turns on their own.
    await expect.poll(async () => (await title(page))?.page, { timeout: 15_000 }).toBe('help');
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
    expect(await snapshot(page)).toMatchObject({ phase: 'ready', level: 1, score: 0 });
    expect(watched.errors).toEqual([]);
    expect(watched.foreignRequests).toEqual([]);
  });

  test('P on the title starts a game that is not paused', async ({ page }) => {
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.takesInput, { timeout: 15_000 }).toBe(true);
    await page.keyboard.press('KeyP');
    await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
    await page.waitForTimeout(300);
    expect((await snapshot(page)).paused).toBe(false);
  });

  test('a shortcut key alone does not start a game', async ({ page }) => {
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.takesInput, { timeout: 15_000 }).toBe(true);
    await page.keyboard.press('Shift');
    await page.keyboard.press('Control');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__game?.scene() ?? null)).toBe('Title');
  });

  test('reduced motion shows the whole cast at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.page, { timeout: 15_000 }).toBe('cast');
    expect((await title(page))?.castShown).toBe(5);
  });

  test('beating the best says NEW BEST!, and Esc goes back to the title', async ({ page }) => {
    await openGame(page, '?seed=7');
    expect((await snapshot(page)).highScore).toBe(0);
    await expect
      .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await page.evaluate(() => window.__game?.endRun());
    const over = await snapshot(page);
    expect(over).toMatchObject({ phase: 'gameover', newBest: true });
    // Esc straight away is ignored, like any key.
    await page.keyboard.press('Escape');
    expect((await snapshot(page)).phase).toBe('gameover');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await title(page))?.highScore).toBe(over.score);
    // The title then starts a fresh game.
    await startFromTitle(page);
    expect(await snapshot(page)).toMatchObject({ phase: 'ready', score: 0, newBest: false });
  });

  test('no NEW BEST! when the run does not beat the stored best', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('waka-waka.highScore', '999999');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await page.evaluate(() => window.__game?.endRun());
    expect(await snapshot(page)).toMatchObject({ phase: 'gameover', newBest: false });
  });

  test('NEW BEST! counts from the start of the run, across mazes', async ({ page }) => {
    await openGame(page, '?seed=7');
    await expect
      .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
      .toBeGreaterThan(0);
    // Clearing the maze saves the score as the best, but the run still beat the old best.
    await page.evaluate(() => window.__game?.skipMaze());
    await expect.poll(async () => (await snapshot(page)).level, { timeout: 15_000 }).toBe(2);
    await page.evaluate(() => window.__game?.endRun());
    expect(await snapshot(page)).toMatchObject({ phase: 'gameover', newBest: true });
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('a tap below the maze starts a game', async ({ page }) => {
      await page.goto('./?seed=7');
      await expect
        .poll(async () => (await title(page))?.takesInput, { timeout: 15_000 })
        .toBe(true);
      await page.touchscreen.tap(195, 800);
      await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
      // The tap that started the game shows no joystick.
      await expect(page.locator('.joystick-on')).toHaveCount(0);
    });
  });
});

test.describe('reduced flash and the fizzle (M4.5)', () => {
  const KEY = 'waka-waka.reducedFlash';
  const title = (page: Page) => page.evaluate(() => window.__game?.title() ?? null);
  const seed = (page: Page, value: string) =>
    page.addInitScript(
      ([k, v]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(k, v);
          sessionStorage.setItem('seeded', '1');
        }
      },
      [KEY, value] as const,
    );

  /** Gets the hero caught, and records the fizzle at every step until the next life. */
  async function recordFizzle(page: Page): Promise<NonNullable<GameSnapshot['death']>[]> {
    await expect
      .poll(async () => (await snapshot(page)).phase, { timeout: 15_000 })
      .toBe('playing');
    await page.evaluate(() => {
      const w = window as unknown as { fizzle: unknown[] };
      w.fizzle = [];
      window.__game?.onStep(() => {
        const death = window.__game?.snapshot()?.death;
        if (death) w.fizzle.push(death);
      });
      window.__game?.catchHero();
    });
    await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('ready');
    return page.evaluate(
      () => (window as unknown as { fizzle: NonNullable<GameSnapshot['death']>[] }).fizzle,
    );
  }

  test('off by default; F on the title switches it on, it is saved, and the game uses it', async ({
    page,
  }) => {
    await page.goto('./?seed=7');
    await expect
      .poll(async () => (await title(page))?.reducedFlash, { timeout: 15_000 })
      .toBe(false);
    await page.keyboard.press('KeyF');
    expect(await title(page)).toMatchObject({ reducedFlash: true });
    // F switches the setting; it doesn't start a game.
    expect(await page.evaluate(() => window.__game?.scene())).toBe('Title');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('1');

    await page.reload();
    await expect
      .poll(async () => (await title(page))?.reducedFlash, { timeout: 15_000 })
      .toBe(true);
    await startFromTitle(page);
    expect((await snapshot(page)).reducedFlash).toBe(true);
    // Only the high score and this setting are ever stored.
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys.every((k) => ['waka-waka.highScore', KEY].includes(k))).toBe(true);
  });

  test('a tap on the button switches it; a tap elsewhere starts a game', async ({ page }) => {
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.takesInput, { timeout: 15_000 }).toBe(true);
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const zoom = box.width / 384;
    // The button is centred, 2.5 tiles above the bottom of the 464 px screen (M5.2 moved it up).
    await page.mouse.click(box.x + box.width / 2, box.y + (464 - 40) * zoom);
    expect(await title(page)).toMatchObject({ reducedFlash: true });
    await page.mouse.click(box.x + box.width / 2, box.y + (464 - 40) * zoom);
    expect(await title(page)).toMatchObject({ reducedFlash: false });
    expect(await page.evaluate(() => window.__game?.scene())).toBe('Title');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  });

  test("follows the device's reduce-motion setting until the player chooses", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?seed=7');
    await expect
      .poll(async () => (await title(page))?.reducedFlash, { timeout: 15_000 })
      .toBe(true);
    await page.keyboard.press('KeyF');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('0');
    await page.reload();
    await expect
      .poll(async () => (await title(page))?.reducedFlash, { timeout: 15_000 })
      .toBe(false);
  });

  for (const bad of ['true', '<b>1</b>', ' 1', '2']) {
    test(`a tampered stored setting (${bad}) is removed`, async ({ page }) => {
      await seed(page, bad);
      await page.goto('./?seed=7');
      await expect
        .poll(async () => (await title(page))?.reducedFlash, { timeout: 15_000 })
        .toBe(false);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    });
  }

  test('caught: the hero crackles, shrinks and bursts, then the next life starts', async ({
    page,
  }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    const fizzle = await recordFizzle(page);
    expect(fizzle.some((d) => d.crackle !== null)).toBe(true);
    expect(fizzle.some((d) => d.heroScale > 0 && d.heroScale < 1)).toBe(true);
    expect(fizzle.some((d) => d.burst !== null && d.burst > 0)).toBe(true);
    expect((await snapshot(page)).lives).toBe(2);
    expect(watched.errors).toEqual([]);
  });

  test('with reduced flash the hero shrinks and bursts with no crackle', async ({ page }) => {
    await seed(page, '1');
    await openGame(page, '?seed=7');
    expect((await snapshot(page)).reducedFlash).toBe(true);
    const fizzle = await recordFizzle(page);
    expect(fizzle.length).toBeGreaterThan(0);
    expect(fizzle.every((d) => d.crackle === null)).toBe(true);
    expect(fizzle.some((d) => d.heroScale > 0 && d.heroScale < 1)).toBe(true);
    expect(fizzle.some((d) => d.burst !== null && d.burst > 0)).toBe(true);
  });
});

test.describe('sound and mute (M5.2)', () => {
  const KEY = 'waka-waka.muted';
  const title = (page: Page) => page.evaluate(() => window.__game?.title() ?? null);
  const sounds = (page: Page) => page.evaluate(() => window.__game?.sounds() ?? {});
  const played = async (page: Page, key: string): Promise<number> =>
    ((await sounds(page)) as Record<string, number>)[key] ?? 0;

  /** Clicks a point on the 384 x 464 game screen. */
  async function clickGame(page: Page, x: number, y: number): Promise<void> {
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const zoom = box.width / 384;
    await page.mouse.click(box.x + x * zoom, box.y + y * zoom);
  }

  test('sound is on by default; M on the title mutes, is saved, and does not start a game', async ({
    page,
  }) => {
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.takesInput, { timeout: 15_000 }).toBe(true);
    expect(await title(page)).toMatchObject({ muted: false });
    await page.keyboard.press('KeyM');
    expect(await title(page)).toMatchObject({ muted: true });
    expect(await page.evaluate(() => window.__game?.scene())).toBe('Title');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('1');

    await page.reload();
    await expect.poll(async () => (await title(page))?.muted, { timeout: 15_000 }).toBe(true);
    await startFromTitle(page);
    expect((await snapshot(page)).muted).toBe(true);
    // Muted: the game plays no sounds at all.
    await expect
      .poll(async () => (await snapshot(page)).score, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(await sounds(page)).toEqual({});
    // Only the high score, reduced flash and mute are ever stored.
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const allowed = ['waka-waka.highScore', 'waka-waka.reducedFlash', KEY];
    expect(keys.every((k) => allowed.includes(k))).toBe(true);
  });

  test('a tap on the sound button switches it', async ({ page }) => {
    await page.goto('./?seed=7');
    await expect.poll(async () => (await title(page))?.takesInput, { timeout: 15_000 }).toBe(true);
    // The button is centred, 1 tile above the bottom of the screen.
    await clickGame(page, 192, 464 - 16);
    expect(await title(page)).toMatchObject({ muted: true });
    await clickGame(page, 192, 464 - 16);
    expect(await title(page)).toMatchObject({ muted: false });
    expect(await page.evaluate(() => window.__game?.scene())).toBe('Title');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('0');
  });

  test('the game plays its sounds: start, GET SET, dots, pause, resume and caught', async ({
    page,
  }) => {
    const watched = watchPage(page);
    await openGame(page, '?seed=7');
    await expect.poll(() => played(page, 'sfx-start'), { timeout: 15_000 }).toBe(1);
    expect(await played(page, 'sfx-ready')).toBe(1);
    await expect.poll(() => played(page, 'sfx-dot'), { timeout: 15_000 }).toBeGreaterThan(0);

    await page.keyboard.press('KeyP');
    await expect.poll(() => played(page, 'sfx-pause')).toBe(1);
    await page.keyboard.press('KeyP');
    await expect.poll(() => played(page, 'sfx-resume')).toBe(1);

    await page.evaluate(() => window.__game?.catchHero());
    await expect.poll(() => played(page, 'sfx-caught'), { timeout: 15_000 }).toBe(1);
    // The next life's GET SET!
    await expect.poll(() => played(page, 'sfx-ready'), { timeout: 15_000 }).toBe(2);
    expect(watched.errors).toEqual([]);
    expect(watched.foreignRequests).toEqual([]);
  });

  test('M in the game mutes and unmutes; muted, nothing plays', async ({ page }) => {
    await openGame(page, '?seed=7');
    await expect.poll(() => played(page, 'sfx-dot'), { timeout: 15_000 }).toBeGreaterThan(0);
    await page.keyboard.press('KeyM');
    await expect.poll(async () => (await snapshot(page)).muted).toBe(true);
    // M doesn't pause.
    expect((await snapshot(page)).paused).toBe(false);
    // Caught and the next life's GET SET! would both play; muted, neither does.
    const before = await sounds(page);
    await page.evaluate(() => window.__game?.catchHero());
    await expect.poll(async () => (await snapshot(page)).phase, { timeout: 15_000 }).toBe('ready');
    expect(await sounds(page)).toEqual(before);
    await page.keyboard.press('KeyM');
    expect((await snapshot(page)).muted).toBe(false);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('0');
  });

  test('a tap on the HUD speaker mutes, even while paused, without resuming', async ({ page }) => {
    await openGame(page, '?seed=7');
    await page.keyboard.press('KeyP');
    await expect.poll(async () => (await snapshot(page)).paused).toBe(true);
    // The speaker is in the middle of the bottom HUD row.
    await clickGame(page, 192, 464 - 8);
    await expect.poll(async () => (await snapshot(page)).muted).toBe(true);
    expect((await snapshot(page)).paused).toBe(true);
    // A tap elsewhere still resumes.
    await clickGame(page, 192, 232);
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
    expect((await snapshot(page)).muted).toBe(true);
  });

  for (const bad of ['true', '<b>1</b>', ' 1', '2']) {
    test(`a tampered stored mute (${bad}) is removed and sound stays on`, async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => {
          if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem(k, v);
            sessionStorage.setItem('seeded', '1');
          }
        },
        [KEY, bad] as const,
      );
      await page.goto('./?seed=7');
      await expect.poll(async () => (await title(page))?.muted, { timeout: 15_000 }).toBe(false);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    });
  }
});
