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

test('arrow keys move the player and it stays on screen', async ({ page }) => {
  await openGame(page);
  const start = (await snapshot(page)).player;
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.x - 20);
  await page.waitForTimeout(2000); // long enough to reach the edge
  await page.keyboard.up('ArrowLeft');
  const left = (await snapshot(page)).player;
  expect(left.x).toBeGreaterThan(0);
  expect(left.y).toBe(start.y);
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
