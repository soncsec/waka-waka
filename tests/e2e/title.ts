import { expect, type Page } from '@playwright/test';

/** Waits for the title screen (M4.3) to take input, then starts a game with a key. */
export async function startFromTitle(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__game?.title()?.takesInput ?? false), {
      timeout: 15_000,
    })
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Game');
}
