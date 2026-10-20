import type Phaser from 'phaser';
import {
  BATTERY_FRAMES,
  batteryPixels,
  dashPixels,
  HERO_MOUTH_FRAMES,
  heroPixels,
  lungePixels,
  opponentPixels,
  scaredPixels,
  SPARK_FRAMES,
  sparkPixels,
  type OpponentLook,
} from '../art/sprites';
import type { Pixels } from '../art/walls';
import { NEON, OPPONENT_ART, PICKUP_ART } from '../config/tuning';
import { DIRS, type Dir } from '../logic/movement';

/** Texture keys for the code-drawn sprites, shared by the title and game scenes. */
export const PELLET_TEXTURE = 'pellet';
export const DOT_TEXTURE = 'dot';
export const batteryTexture = (frame: number): string => `battery-${frame}`;
export const heroTexture = (dir: Dir, frame: number): string => `hero-${dir}-${frame}`;
export const scaredTexture = (index: number, look: OpponentLook, frame: number): string =>
  `scared-${index}-${look}-${frame}`;
export const sparkTexture = (frame: number): string => `spark-${frame}`;
export const frenzyTexture = (dir: Dir, frame: number): string => `frenzy-${dir}-${frame}`;
export const dashTexture = (dir: Dir): string => `dash-${dir}`;
export const lungeTexture = (dir: Dir): string => `lunge-${dir}`;
export const opponentTexture = (index: number, dir: Dir, frame: number): string =>
  `opponent-${index}-${dir}-${frame}`;

/** Turns pixel art into a texture under `key`, once; later calls reuse it. */
export function addPixelTexture(scene: Phaser.Scene, key: string, art: () => Pixels): void {
  if (scene.textures.exists(key)) return;
  const pixels = art();
  const texture = scene.textures.createCanvas(key, pixels.width, pixels.height);
  if (!texture) throw new Error(`could not create texture ${key}`);
  texture.getContext().putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  texture.refresh();
}

/** Makes every sprite texture the scenes use. Textures are global, so this runs once per game. */
export function makeTextures(scene: Phaser.Scene): void {
  for (const dir of DIRS) {
    HERO_MOUTH_FRAMES.forEach((mouth, frame) => {
      addPixelTexture(scene, heroTexture(dir, frame), () => heroPixels(dir, mouth));
    });
    for (let frame = 0; frame < OPPONENT_ART.frames; frame++) {
      for (const who of [0, 1, 2, 3] as const) {
        addPixelTexture(scene, opponentTexture(who, dir, frame), () =>
          opponentPixels(who, dir, frame),
        );
      }
      addPixelTexture(scene, frenzyTexture(dir, frame), () =>
        opponentPixels(0, dir, frame, NEON.frenzyHot),
      );
    }
    addPixelTexture(scene, dashTexture(dir), () => dashPixels(dir));
    addPixelTexture(scene, lungeTexture(dir), () => lungePixels(dir));
  }
  for (let frame = 0; frame < BATTERY_FRAMES; frame++) {
    addPixelTexture(scene, batteryTexture(frame), () => batteryPixels(frame + 1));
  }
  for (let frame = 0; frame < SPARK_FRAMES; frame++) {
    addPixelTexture(scene, sparkTexture(frame), () => sparkPixels(frame));
  }
  for (let frame = 0; frame < OPPONENT_ART.frames; frame++) {
    for (const who of [0, 1, 2, 3] as const) {
      for (const look of ['scared', 'flash'] as const) {
        addPixelTexture(scene, scaredTexture(who, look, frame), () =>
          scaredPixels(who, look, frame),
        );
      }
    }
  }
  makeRectTextures(scene);
}

/** The power pellet (a rounded square with a white core) and a dot, drawn with Graphics. */
function makeRectTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PELLET_TEXTURE)) {
    const n = PICKUP_ART.pelletSize;
    const g = scene.make.graphics({}, false);
    g.fillStyle(NEON.pellet);
    g.fillRect(1, 0, n - 2, n);
    g.fillRect(0, 1, n, n - 2);
    g.fillStyle(NEON.pelletCore);
    g.fillRect(2, 1, n - 4, n - 2);
    g.fillRect(1, 2, n - 2, n - 4);
    g.generateTexture(PELLET_TEXTURE, n, n);
    g.destroy();
  }
  if (!scene.textures.exists(DOT_TEXTURE)) {
    const s = PICKUP_ART.dotSize;
    const g = scene.make.graphics({}, false);
    g.fillStyle(NEON.dot);
    g.fillRect(0, 0, s, s);
    g.generateTexture(DOT_TEXTURE, s, s);
    g.destroy();
  }
}
