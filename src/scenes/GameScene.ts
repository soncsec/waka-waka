import Phaser from 'phaser';
import {
  eyesPixels,
  HERO_MOUTH_FRAMES,
  heroPixels,
  opponentPixels,
  scaredPixels,
  type OpponentLook,
} from '../art/sprites';
import { drawWalls, type Pixels } from '../art/walls';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HERO,
  HUD,
  HUD_HEIGHT,
  MAX_STEPS_PER_FRAME,
  NEON,
  OPPONENT_ART,
  PICKUP_ART,
  ROUND,
  SCARED_ART,
  STEP_HZ,
  SWIPE,
  TILE_SIZE,
} from '../config/tuning';
import {
  clearMaze,
  createGame,
  modeOf,
  nextMazeDue,
  powerUp,
  setWanted,
  stepGame,
  type Carry,
  type GameState,
  type Phase,
} from '../logic/game';
import { buildMaze, TILE } from '../logic/maze';
import { DIRS, type Dir, type Point } from '../logic/movement';
import type { OpponentName, OpponentState } from '../logic/opponents';
import { parseSeed, seedFromRandomWord } from '../logic/seed';
import { swipeDirection } from '../logic/swipe';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  seed: number;
  level: number;
  hero: { x: number; y: number; dir: Dir; moving: boolean };
  opponents: {
    name: OpponentName;
    x: number;
    y: number;
    dir: Dir;
    state: OpponentState;
    scared: boolean;
  }[];
  /** Seconds of scare left after a power pellet. */
  scaredTime: number;
  wanted: Dir | null;
  score: number;
  lives: number;
  phase: Phase;
  /** scatter or chase (WW-02). */
  mode: 'scatter' | 'chase';
  dotsLeft: number;
  /** The centre message (READY! or MAZE CLEARED!) while it shows, else null. */
  message: string | null;
  maze: { grid: readonly string[]; usedFallback: boolean };
  /** Logical canvas size and the current whole-number zoom. */
  screen: { width: number; height: number; zoom: number };
}

const PELLET_TEXTURE = 'pellet';
const heroTexture = (dir: Dir, frame: number): string => `hero-${dir}-${frame}`;
const scaredTexture = (index: number, look: OpponentLook, frame: number): string =>
  `scared-${index}-${look}-${frame}`;
const eyesTexture = (dir: Dir): string => `eyes-${dir}`;
const opponentTexture = (index: number, dir: Dir, frame: number): string =>
  `opponent-${index}-${dir}-${frame}`;

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

/** Passed by `scene.restart` from one maze to the next; empty for a new game. */
interface SceneData {
  seed?: number;
  level?: number;
  carry?: Carry;
}

/** A 0xrrggbb colour as the CSS string Phaser text styles want. */
const cssColour = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Screen centre of a tile position. */
const toScreen = (p: Point): Point => ({
  x: p.x * TILE_SIZE + TILE_SIZE / 2,
  y: HUD_HEIGHT + p.y * TILE_SIZE + TILE_SIZE / 2,
});

/** One maze being played: the hero eats dots while the four opponents give chase. */
export class GameScene extends Phaser.Scene {
  private seed = 0;
  private level = 1;
  private carry: Carry | undefined;
  private usedFallback = false;
  private state!: GameState;
  private dots!: Phaser.GameObjects.Graphics;
  private pellets = new Map<string, Phaser.GameObjects.Image>();
  private hero!: Phaser.GameObjects.Image;
  private opponents: Phaser.GameObjects.Image[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private message!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private gameOverPanel!: Phaser.GameObjects.Container;
  private swipeStart: Point | null = null;
  /** Unsimulated time, in seconds (fixed-step loop, WW-01). */
  private pending = 0;
  private readonly steadyPellets = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    super('Game');
  }

  init(data: SceneData): void {
    this.seed = data.seed ?? runSeed();
    this.level = data.level ?? 1;
    this.carry = data.carry;
  }

  create(): void {
    // The scene object is reused when a new game starts, so reset everything here.
    this.pellets = new Map();
    this.opponents = [];
    this.lifeIcons = [];
    this.swipeStart = null;
    this.pending = 0;
    const built = buildMaze(this.seed, this.level);
    this.usedFallback = built.usedFallback;
    this.state = createGame(built.maze, { level: this.level, carry: this.carry });

    this.makeTextures();
    this.drawMaze();
    this.drawHud();
    this.opponents = this.state.opponents.map((o, i) =>
      this.add.image(0, 0, opponentTexture(i, o.dir, 0)),
    );
    this.hero = this.add.image(0, 0, heroTexture(this.state.hero.dir, 1));
    this.drawMessages();
    this.placeActors(0);
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

    if (nextMazeDue(this.state)) {
      const { score, lives } = this.state;
      this.scene.restart({ seed: this.seed, level: this.level + 1, carry: { score, lives } });
      return;
    }

    this.scoreText.setText(String(this.state.score).padStart(6, '0'));
    this.placeActors(time);
    this.showPhase();
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
      opponents: this.state.opponents.map(({ name, x, y, dir, state, scared }) => ({
        name,
        x,
        y,
        dir,
        state,
        scared,
      })),
      scaredTime: this.state.scaredTime,
      wanted: this.state.wanted,
      score: this.state.score,
      lives: this.state.lives,
      phase: this.state.phase,
      mode: modeOf(this.state),
      dotsLeft: this.state.dotsLeft,
      message: this.message.visible ? this.message.text : null,
      maze: { grid: this.state.maze.grid, usedFallback: this.usedFallback },
      screen: { width: GAME_WIDTH, height: GAME_HEIGHT, zoom: this.scale.zoom },
    };
  }

  /** Test hook: clears the maze at once. */
  /** Test hook: the effect of a power pellet, without walking to one. */
  powerUp(): void {
    powerUp(this.state);
  }

  skipMaze(): void {
    clearMaze(this.state);
    this.redrawDots();
    for (const p of this.pellets.values()) p.destroy();
    this.pellets.clear();
    this.showPhase();
  }

  private setUpInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input is not available');
    // Stop arrow keys scrolling the page while the game has focus.
    kb.addCapture('UP,DOWN,LEFT,RIGHT');
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.restartIfOver()) return;
      const dir = KEY_DIRS[e.code];
      if (dir) setWanted(this.state, dir);
    });

    // Swipes (WW-06): a direction is taken as soon as the finger has moved far
    // enough, and a new swipe can start without lifting the finger.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.restartIfOver()) return;
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

    // The scene is reused for the next game: drop these listeners when it shuts down.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.removeAllListeners('keydown');
      this.input.removeAllListeners('pointerdown');
      this.input.removeAllListeners('pointermove');
      this.input.removeAllListeners('pointerup');
    });
  }

  /** At game over, after a short delay, any key or tap starts a new game. */
  private restartIfOver(): boolean {
    if (this.state.phase !== 'gameover') return false;
    if (this.state.phaseTime >= ROUND.restartDelay) this.scene.restart({});
    return true;
  }

  private placeActors(time: number): void {
    const { hero, opponents, phase } = this.state;
    const chomping = phase === 'playing' && hero.moving;
    const frame = chomping
      ? Math.floor((time / 1000) * HERO.chompHz) % HERO_MOUTH_FRAMES.length
      : 1;
    const h = toScreen(hero);
    this.hero.setPosition(h.x, h.y).setTexture(heroTexture(hero.dir, frame));
    // Caught: the hero flickers until the next life.
    this.hero.setVisible(phase !== 'dying' || Math.floor(time / 100) % 2 === 0);

    const seconds = time / 1000;
    const bob = Math.floor(seconds * OPPONENT_ART.bobHz) % 2;
    const mFrame = Math.floor(seconds * OPPONENT_ART.frameHz) % OPPONENT_ART.frames;
    opponents.forEach((o, i) => {
      const img = this.opponents[i];
      if (!img) return;
      const p = toScreen(o);
      // Only opponents out in the maze bob; the others already move up and down.
      const lift = o.state === 'out' ? bob : 0;
      img.setPosition(p.x, p.y + lift).setTexture(this.opponentKey(i, o, mFrame, seconds));
      img.setVisible(phase !== 'gameover');
    });
  }

  /** Texture for an opponent: eyes when eaten, blue when scared (flashing near the end). */
  private opponentKey(
    i: number,
    o: GameState['opponents'][number],
    frame: number,
    seconds: number,
  ): string {
    if (o.state === 'eyes' || o.state === 'entering') return eyesTexture(o.dir);
    if (!o.scared) return opponentTexture(i, o.dir, frame);
    const ending = this.state.scaredTime < SCARED_ART.flashSeconds;
    const flash = ending && Math.floor(seconds * SCARED_ART.flashHz * 2) % 2 === 0;
    return scaredTexture(i, flash ? 'flash' : 'scared', frame);
  }

  /** Life icons, the READY message and the game-over panel follow the phase. */
  private showPhase(): void {
    const { phase, lives } = this.state;
    // Lives in reserve: the one being played isn't shown.
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < lives - 1));
    this.message.setVisible(phase === 'ready' || phase === 'cleared');
    this.message.setText(phase === 'cleared' ? 'MAZE CLEARED!' : 'READY!');
    // The controls hint shows with READY! on the first maze only.
    this.hint.setVisible(phase === 'ready' && this.level === 1);
    this.gameOverPanel.setVisible(phase === 'gameover');
  }

  private drawMessages(): void {
    const { house } = this.state.maze;
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: NEON.ready };
    // READY! sits on the corridor just below the ghost house.
    const below = toScreen({ x: 0, y: house.y1 + 1 });
    this.message = this.add.text(GAME_WIDTH / 2, below.y, 'READY!', style).setOrigin(0.5);
    const dim = { ...style, color: NEON.hudDim };
    // On a dark strip, so it reads over the dots.
    const strip = { ...dim, backgroundColor: cssColour(NEON.background), padding: { x: 4, y: 2 } };
    this.hint = this.add
      .text(GAME_WIDTH / 2, below.y + TILE_SIZE, 'ARROWS, WASD OR SWIPE', strip)
      .setOrigin(0.5);

    const middle = toScreen({ x: 0, y: (house.y0 + house.y1) / 2 });
    const panel = this.add
      .rectangle(0, 0, GAME_WIDTH - 4 * TILE_SIZE, 4 * TILE_SIZE, NEON.background, 0.92)
      .setStrokeStyle(2, NEON.wallLine);
    const title = this.add
      .text(0, -16, 'GAME OVER', { ...style, color: NEON.gameOver })
      .setOrigin(0.5);
    // The run seed, so a player can report or replay this run with ?seed=.
    const seed = this.add.text(0, 0, `SEED ${this.seed}`, dim).setOrigin(0.5);
    const hint = this.add
      .text(0, 16, 'PRESS A KEY OR TAP', { ...style, color: NEON.hud })
      .setOrigin(0.5);
    this.gameOverPanel = this.add.container(GAME_WIDTH / 2, middle.y, [panel, title, seed, hint]);
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
    const key = `walls-${this.seed}-${this.level}`;
    // The same seed and level always give the same maze, so a restart reuses the texture.
    if (!this.textures.exists(key)) this.addPixelTexture(key, drawWalls(maze, TILE_SIZE));
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
    for (const dir of DIRS) {
      for (let frame = 0; frame < OPPONENT_ART.frames; frame++) {
        for (const who of [0, 1, 2, 3] as const) {
          const key = opponentTexture(who, dir, frame);
          if (!this.textures.exists(key))
            this.addPixelTexture(key, opponentPixels(who, dir, frame));
        }
      }
      const eyes = eyesTexture(dir);
      if (!this.textures.exists(eyes)) this.addPixelTexture(eyes, eyesPixels(dir));
    }
    for (let frame = 0; frame < OPPONENT_ART.frames; frame++) {
      for (const who of [0, 1, 2, 3] as const) {
        for (const look of ['scared', 'flash'] as const) {
          const key = scaredTexture(who, look, frame);
          if (!this.textures.exists(key)) this.addPixelTexture(key, scaredPixels(who, look, frame));
        }
      }
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
    // Spare lives, bottom left.
    const iconY = GAME_HEIGHT - HUD_HEIGHT / 2;
    for (let i = 0; i < ROUND.lives - 1; i++) {
      const x = m + TILE_SIZE / 2 + i * (TILE_SIZE + 2);
      this.lifeIcons.push(this.add.image(x, iconY, heroTexture('right', 1)));
    }
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
