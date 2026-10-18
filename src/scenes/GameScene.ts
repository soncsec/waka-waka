import Phaser from 'phaser';
import { HERO_MOUTH_FRAMES, heroPixels } from '../art/sprites';
import { drawWalls, type Pixels } from '../art/walls';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HERO,
  HUD,
  HUD_HEIGHT,
  MAX_STEPS_PER_FRAME,
  NEON,
  PICKUP_ART,
  STEP_HZ,
  SWIPE,
  TILE_SIZE,
} from '../config/tuning';
import { createGame, setWanted, stepGame, type GameState } from '../logic/game';
import { buildMaze, TILE } from '../logic/maze';
import { DIRS, type Dir, type Point } from '../logic/movement';
import { parseSeed, seedFromRandomWord } from '../logic/seed';
import { swipeDirection } from '../logic/swipe';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  seed: number;
  level: number;
  hero: { x: number; y: number; dir: Dir; moving: boolean };
  wanted: Dir | null;
  score: number;
  dotsLeft: number;
  maze: { grid: readonly string[]; usedFallback: boolean };
  /** Logical canvas size and the current whole-number zoom. */
  screen: { width: number; height: number; zoom: number };
}

const PELLET_TEXTURE = 'pellet';
const heroTexture = (dir: Dir, frame: number): string => `hero-${dir}-${frame}`;

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

/** Screen centre of a tile position. */
const toScreen = (p: Point): Point => ({
  x: p.x * TILE_SIZE + TILE_SIZE / 2,
  y: HUD_HEIGHT + p.y * TILE_SIZE + TILE_SIZE / 2,
});

/** One maze being played: the hero moves on the grid and eats dots (M1.3). */
export class GameScene extends Phaser.Scene {
  private seed = 0;
  private level = 1;
  private usedFallback = false;
  private state!: GameState;
  private dots!: Phaser.GameObjects.Graphics;
  private readonly pellets = new Map<string, Phaser.GameObjects.Image>();
  private hero!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private swipeStart: Point | null = null;
  /** Unsimulated time, in seconds (fixed-step loop, WW-01). */
  private pending = 0;
  private readonly steadyPellets = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = runSeed();
    const built = buildMaze(this.seed, this.level);
    this.usedFallback = built.usedFallback;
    this.state = createGame(built.maze);

    this.makeTextures();
    this.drawMaze();
    this.drawHud();
    this.hero = this.add.image(0, 0, heroTexture(this.state.hero.dir, 1));
    this.placeHero(0);
    this.setUpInput();
  }

  override update(time: number, deltaMs: number): void {
    this.pending += deltaMs / 1000;
    const dt = 1 / STEP_HZ;
    let steps = 0;
    while (this.pending >= dt && steps < MAX_STEPS_PER_FRAME) {
      for (const e of stepGame(this.state, dt)) this.removePickup(e.x, e.y, e.kind);
      this.pending -= dt;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.pending = 0;

    this.scoreText.setText(String(this.state.score).padStart(6, '0'));
    this.placeHero(time);
    const lit =
      this.steadyPellets || Math.floor((time / 1000) * PICKUP_ART.pelletBlinkHz * 2) % 2 === 0;
    for (const p of this.pellets.values()) p.setVisible(lit);
  }

  snapshot(): GameSnapshot {
    const { hero } = this.state;
    return {
      seed: this.seed,
      level: this.level,
      hero: { x: hero.x, y: hero.y, dir: hero.dir, moving: hero.moving },
      wanted: this.state.wanted,
      score: this.state.score,
      dotsLeft: this.state.dotsLeft,
      maze: { grid: this.state.maze.grid, usedFallback: this.usedFallback },
      screen: { width: GAME_WIDTH, height: GAME_HEIGHT, zoom: this.scale.zoom },
    };
  }

  private setUpInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input is not available');
    // Stop arrow keys scrolling the page while the game has focus.
    kb.addCapture('UP,DOWN,LEFT,RIGHT');
    kb.on('keydown', (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.code];
      if (dir) setWanted(this.state, dir);
    });

    // Swipes (WW-06): a direction is taken as soon as the finger has moved far
    // enough, and a new swipe can start without lifting the finger.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart || !p.isDown) return;
      const dir = swipeDirection(
        p.x - this.swipeStart.x,
        p.y - this.swipeStart.y,
        SWIPE.minDistance,
      );
      if (dir) {
        setWanted(this.state, dir);
        this.swipeStart = { x: p.x, y: p.y };
      }
    });
    this.input.on('pointerup', () => {
      this.swipeStart = null;
    });
  }

  private placeHero(time: number): void {
    const { hero } = this.state;
    const frame = hero.moving
      ? Math.floor((time / 1000) * HERO.chompHz) % HERO_MOUTH_FRAMES.length
      : 1;
    const p = toScreen(hero);
    this.hero.setPosition(p.x, p.y).setTexture(heroTexture(hero.dir, frame));
  }

  private removePickup(x: number, y: number, kind: 'dot' | 'pellet'): void {
    if (kind === 'pellet') {
      this.pellets.get(`${x},${y}`)?.destroy();
      this.pellets.delete(`${x},${y}`);
    } else {
      this.redrawDots();
    }
  }

  private drawMaze(): void {
    const { maze } = this.state;
    const art = drawWalls(maze, TILE_SIZE);
    const key = `walls-${this.seed}-${this.level}`;
    this.addPixelTexture(key, art);
    this.add.image(0, HUD_HEIGHT, key).setOrigin(0, 0);

    this.dots = this.add.graphics({ fillStyle: { color: NEON.dot } });
    this.redrawDots();
    this.state.tiles.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c !== TILE.pellet) return;
        const p = toScreen({ x, y });
        this.pellets.set(`${x},${y}`, this.add.image(p.x, p.y, PELLET_TEXTURE));
      }),
    );
  }

  /** Dots: one Graphics object, redrawn when a dot is eaten. */
  private redrawDots(): void {
    const s = PICKUP_ART.dotSize;
    this.dots.clear();
    this.state.tiles.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c !== TILE.dot) return;
        const p = toScreen({ x, y });
        this.dots.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }),
    );
  }

  private makeTextures(): void {
    for (const dir of DIRS) {
      HERO_MOUTH_FRAMES.forEach((mouth, frame) => {
        const key = heroTexture(dir, frame);
        if (!this.textures.exists(key)) this.addPixelTexture(key, heroPixels(dir, mouth));
      });
    }
    if (this.textures.exists(PELLET_TEXTURE)) return;
    const n = PICKUP_ART.pelletSize;
    const g = this.make.graphics({}, false);
    // A rounded square: the outer ring in neon pink, the core white.
    g.fillStyle(NEON.pellet);
    g.fillRect(1, 0, n - 2, n);
    g.fillRect(0, 1, n, n - 2);
    g.fillStyle(NEON.pelletCore);
    g.fillRect(2, 1, n - 4, n - 2);
    g.fillRect(1, 2, n - 2, n - 4);
    g.generateTexture(PELLET_TEXTURE, n, n);
    g.destroy();
  }

  private addPixelTexture(key: string, art: Pixels): void {
    const texture = this.textures.createCanvas(key, art.width, art.height);
    if (!texture) throw new Error(`could not create texture ${key}`);
    texture.getContext().putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
    texture.refresh();
  }

  private drawHud(): void {
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: NEON.hud };
    const dim = { ...style, color: NEON.hudDim };
    const m = HUD.margin;
    const top = (HUD_HEIGHT - HUD.fontSize) / 2;
    const bottom = GAME_HEIGHT - HUD_HEIGHT + top;
    const label = this.add.text(m, top, 'SCORE', dim);
    this.scoreText = this.add.text(m + label.width + HUD.fontSize, top, '000000', style);
    const hi = this.add.text(GAME_WIDTH - m, top, '000000', style).setOrigin(1, 0);
    this.add.text(hi.x - hi.width - HUD.fontSize, top, 'HI', dim).setOrigin(1, 0);
    this.add.text(GAME_WIDTH - m, bottom, `MAZE ${this.level}`, style).setOrigin(1, 0);
  }
}

/**
 * The run seed: a valid ?seed= from the URL replays a run (WW-08); otherwise a
 * random one, so every run gets new mazes.
 */
function runSeed(): number {
  const fromUrl = parseSeed(new URLSearchParams(window.location.search).get('seed'));
  if (fromUrl !== null) return fromUrl;
  return seedFromRandomWord(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0);
}
