import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, HUD, NEON } from './config/tuning';
import { integerZoom } from './logic/scaling';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';

const zoomForWindow = (): number =>
  integerZoom(window.innerWidth, window.innerHeight, GAME_WIDTH, GAME_HEIGHT);

// Canvas text can't wait for a web font, so load the HUD font before the game
// starts. If it fails, the game still runs with a fallback font.
await document.fonts.load(`${HUD.fontSize}px ${HUD.font}`).catch(() => undefined);

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: `#${NEON.background.toString(16).padStart(6, '0')}`,
  pixelArt: true,
  roundPixels: true,
  scale: {
    // Whole-number zoom keeps pixels crisp; the page's CSS centers the canvas.
    mode: Phaser.Scale.NONE,
    zoom: zoomForWindow(),
  },
  // The first scene listed starts first.
  scene: [TitleScene, GameScene],
});

window.addEventListener('resize', () => {
  const zoom = zoomForWindow();
  if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
});

// The e2e build adds a test hook. Vite replaces MODE at build time, so this
// branch and the hook module are left out of the normal build entirely.
if (import.meta.env.MODE === 'e2e') {
  void import('./debug/testHook').then(({ installTestHook }) => installTestHook(game));
}
