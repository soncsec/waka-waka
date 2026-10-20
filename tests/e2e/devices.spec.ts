import { expect, test } from '@playwright/test';
import { startFromTitle } from './title';

/**
 * The game must fit, at a whole-number zoom, on the screens the owner plays on (WW-05):
 * desktop, a phone held upright, and a tablet held either way.
 */
const SCREENS = [
  { name: 'laptop 1080p', width: 1920, height: 950, touch: false, zoom: 2 },
  { name: 'small laptop', width: 1366, height: 650, touch: false, zoom: 1 },
  { name: 'phone, portrait', width: 390, height: 844, touch: true, zoom: 1 },
  { name: 'tablet, portrait', width: 768, height: 1024, touch: true, zoom: 2 },
  { name: 'tablet, landscape', width: 1024, height: 768, touch: true, zoom: 1 },
] as const;

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test.use({
      viewport: { width: screen.width, height: screen.height },
      hasTouch: screen.touch,
    });

    test(`fits on screen at zoom ${screen.zoom}`, async ({ page }) => {
      await page.goto('./?seed=7');
      await startFromTitle(page);
      const zoom = await page.evaluate(() => window.__game?.snapshot()?.screen.zoom);
      expect(zoom).toBe(screen.zoom);
      const box = await page.locator('#game canvas').boundingBox();
      if (!box) throw new Error('no canvas');
      expect([box.width, box.height]).toEqual([384 * screen.zoom, 464 * screen.zoom]);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(screen.width);
      expect(box.y + box.height).toBeLessThanOrEqual(screen.height);
      // No page scrolling: the page is exactly the screen.
      const scroll = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ]);
      expect(scroll).toEqual([screen.width, screen.height]);
    });
  });
}
