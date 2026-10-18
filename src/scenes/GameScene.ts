import Phaser from 'phaser';
import { drawWalls } from '../art/walls';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD,
  HUD_HEIGHT,
  NEON,
  PICKUP_ART,
  PLAYER,
  TILE_SIZE,
} from '../config/tuning';
import { buildMaze, TILE, type Maze } from '../logic/maze';
import { screenBounds, step, type Axis, type Point } from '../logic/movement';
import { parseSeed, seedFromRandomWord } from '../logic/seed';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  player: Point;
  seed: number;
  level: number;
  maze: { grid: readonly string[]; usedFallback: boolean };
  /** Logical canvas size and the current whole-number zoom. */
  screen: { width: number; height: number; zoom: number };
}

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
  Phaser.Input.Keyboard.Key
>;

const PELLET_TEXTURE = 'pellet';

/** Draws the current maze in look B. The hero, opponents and scoring arrive in M1.3 and M1.4. */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private pos: Point = { x: 0, y: 0 };
  private keys!: Keys;
  private seed = 0;
  private level = 1;
  private maze!: Maze;
  private usedFallback = false;
  private pellets: Phaser.GameObjects.Image[] = [];
  private readonly steadyPellets = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly bounds = screenBounds(GAME_WIDTH, GAME_HEIGHT, PLAYER.size);

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = runSeed();
    this.loadMaze(this.level);
    this.drawHud();

    this.pos = { x: GAME_WIDTH / 2, y: GAME_HEIGHT * PLAYER.startY };
    this.player = this.add.rectangle(
      this.pos.x,
      this.pos.y,
      PLAYER.size,
      PLAYER.size,
      PLAYER.color,
    );

    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input is not available');
    this.keys = kb.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
    }) as Keys;
  }

  override update(time: number, deltaMs: number): void {
    this.pos = step(this.pos, this.readAxis(), deltaMs / 1000, PLAYER.speed, this.bounds);
    this.player.setPosition(this.pos.x, this.pos.y);

    const lit =
      this.steadyPellets || Math.floor((time / 1000) * PICKUP_ART.pelletBlinkHz * 2) % 2 === 0;
    for (const p of this.pellets) p.setVisible(lit);
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.pos },
      seed: this.seed,
      level: this.level,
      maze: { grid: this.maze.grid, usedFallback: this.usedFallback },
      screen: { width: GAME_WIDTH, height: GAME_HEIGHT, zoom: this.scale.zoom },
    };
  }

  private loadMaze(level: number): void {
    const built = buildMaze(this.seed, level);
    this.maze = built.maze;
    this.usedFallback = built.usedFallback;

    // Walls: drawn once into a canvas texture.
    const art = drawWalls(this.maze, TILE_SIZE);
    const key = `walls-${this.seed}-${level}`;
    const texture = this.textures.createCanvas(key, art.width, art.height);
    if (!texture) throw new Error('could not create the wall texture');
    texture.getContext().putImageData(new ImageData(art.data, art.width, art.height), 0, 0);
    texture.refresh();
    this.add.image(0, HUD_HEIGHT, key).setOrigin(0, 0);

    // Dots: one Graphics object for all of them.
    const dots = this.add.graphics({ fillStyle: { color: NEON.dot } });
    const s = PICKUP_ART.dotSize;
    this.forEachTile((x, y, c) => {
      if (c === TILE.dot) dots.fillRect(x - s / 2, y - s / 2, s, s);
    });

    // Power pellets: one shared texture.
    this.makePelletTexture();
    this.forEachTile((x, y, c) => {
      if (c === TILE.pellet) this.pellets.push(this.add.image(x, y, PELLET_TEXTURE));
    });
  }

  /** Calls `fn` with the screen centre of every tile. */
  private forEachTile(fn: (x: number, y: number, c: string) => void): void {
    this.maze.grid.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        fn(
          tx * TILE_SIZE + TILE_SIZE / 2,
          HUD_HEIGHT + ty * TILE_SIZE + TILE_SIZE / 2,
          row[tx] as string,
        );
      }
    });
  }

  private makePelletTexture(): void {
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

  private drawHud(): void {
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: NEON.hud };
    const dim = { ...style, color: NEON.hudDim };
    const m = HUD.margin;
    const top = (HUD_HEIGHT - HUD.fontSize) / 2;
    const bottom = GAME_HEIGHT - HUD_HEIGHT + top;
    const label = this.add.text(m, top, 'SCORE', dim);
    this.add.text(m + label.width + HUD.fontSize, top, '000000', style);
    const hi = this.add.text(GAME_WIDTH - m, top, '000000', style).setOrigin(1, 0);
    this.add.text(hi.x - hi.width - HUD.fontSize, top, 'HI', dim).setOrigin(1, 0);
    this.add.text(GAME_WIDTH - m, bottom, `MAZE ${this.level}`, style).setOrigin(1, 0);
  }

  private readAxis(): Axis {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    return {
      x: left === right ? 0 : left ? -1 : 1,
      y: up === down ? 0 : up ? -1 : 1,
    };
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
