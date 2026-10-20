import type Phaser from 'phaser';
import { STEP_EVENT, type GameScene, type GameSnapshot } from '../scenes/GameScene';
import type { TitleScene, TitleSnapshot } from '../scenes/TitleScene';
import { soundLog } from '../scenes/sound';
import type { SoundKey } from '../config/audio';

/**
 * Test-only hook for Playwright (ADR-006). It is loaded only in the e2e build
 * (`vite build --mode e2e`), so the build players get never includes it.
 * Add controls here as the game grows (spawn an enemy, skip a level, ...).
 */
export interface TestHook {
  /** The key of the scene that is running, or null while loading. */
  scene(): string | null;
  snapshot(): GameSnapshot | null;
  /** The title screen (M4.3) while it shows, else null. */
  title(): TitleSnapshot | null;
  /** Ends the run now, as losing the last life would. */
  endRun(): void;
  /** The hero is caught now, during play (M4.5). */
  catchHero(): void;
  /** Eats every dot left, so the maze is cleared at once. */
  skipMaze(): void;
  /** Scares the opponents as a power pellet would. */
  powerUp(): void;
  /** Makes an opponent's special move due (0 = Murk's Frenzy). */
  primeSpecial(index: number): void;
  /** Puts the bonus battery out on the hero's start spot (M3.3). */
  showBonus(): void;
  /** Calls `fn` after every simulation step, from now on (also on later mazes). */
  onStep(fn: () => void): void;
  /** How many times each sound has played so far (M5.2); muted sounds don't count. */
  sounds(): Partial<Record<SoundKey, number>>;
}

declare global {
  interface Window {
    __game?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
  window.__game = {
    scene: () => game.scene.getScenes(true)[0]?.scene.key ?? null,
    snapshot: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      return s && game.scene.isActive('Game') ? s.snapshot() : null;
    },
    title: () => {
      const s = game.scene.getScene('Title') as TitleScene | null;
      return s && game.scene.isActive('Title') ? s.snapshot() : null;
    },
    catchHero: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.catchHero();
    },
    endRun: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.endRun();
    },
    skipMaze: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.skipMaze();
    },
    powerUp: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.powerUp();
    },
    primeSpecial: (index: number) => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.primeSpecial(index);
    },
    onStep: (fn: () => void) => {
      const s = game.scene.getScene('Game') as GameScene | null;
      s?.events.on(STEP_EVENT, fn);
    },
    sounds: () => ({ ...soundLog }),
    showBonus: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      if (s && game.scene.isActive('Game')) s.showBonus();
    },
  };
}
