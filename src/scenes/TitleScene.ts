import Phaser from 'phaser';
import { BATTERY_FRAMES, HERO_MOUTH_FRAMES } from '../art/sprites';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HERO,
  HUD,
  NEON,
  OPPONENT_ART,
  ROUND,
  SCORE,
  TILE_SIZE,
  TITLE,
} from '../config/tuning';
import { levelRow } from '../logic/difficulty';
import { titleTakesInput, titleView, type TitlePage } from '../logic/title';
import { createRotatePrompt } from '../ui/rotatePrompt';
import { loadHighScore } from './highScoreStore';
import { loadReducedFlash, storeReducedFlash } from './reducedFlashStore';
import {
  batteryTexture,
  DOT_TEXTURE,
  heroTexture,
  makeTextures,
  opponentTexture,
  PELLET_TEXTURE,
  scaredTexture,
} from './textures';

/** Read-only view of the title screen, used by the e2e test hook. */
export interface TitleSnapshot {
  page: TitlePage;
  castShown: number;
  /** Keys and taps start a game (after TITLE.inputDelay). */
  takesInput: boolean;
  highScore: number;
  /** The reduced-flash setting (M4.5), changed here with F or a tap on its button. */
  reducedFlash: boolean;
}

/** Who's who, in the order their moves switch on (WW-10). `who` is the opponent index, or the hero. */
const CAST = [
  { who: 'hero', name: 'YOU', line: 'EAT EVERY DOT TO CLEAR A MAZE' },
  { who: 0, name: 'MURK', line: 'FRENZY: GLOWS, THEN SPEEDS UP' },
  { who: 2, name: 'BOLT', line: 'DASH: AIMS, THEN SHOOTS AHEAD' },
  { who: 1, name: 'GNASH', line: 'LUNGE: BARES TEETH, THEN JUMPS' },
  { who: 3, name: 'WISP', line: 'PHASE: FADES THROUGH A WALL' },
] as const;

/** Keys that don't start a game on their own, so browser shortcuts and Alt-Tab don't. */
const IGNORED_KEYS: ReadonlySet<string> = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'Tab',
  'CapsLock',
]);

const cssColour = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** The key that switches reduced flash on and off (M4.5). */
const FLASH_KEY = 'KeyF';

/**
 * The title screen (M4.3): the logo and best score, with the cast page and the
 * how-to-play page taking turns. Any key or tap starts a game, except F or a
 * tap on the reduced-flash button, which switch that setting (M4.5).
 */
export class TitleScene extends Phaser.Scene {
  /** Seconds since the title appeared. */
  private elapsed = 0;
  private starting = false;
  private highScore = 0;
  private castPage!: Phaser.GameObjects.Container;
  private castRows: Phaser.GameObjects.Container[] = [];
  private helpPage!: Phaser.GameObjects.Container;
  private prompt!: Phaser.GameObjects.Text;
  private heroes: Phaser.GameObjects.Image[] = [];
  private opponents: { img: Phaser.GameObjects.Image; who: number }[] = [];
  /** Reduced flash (M4.5) also holds the prompt steady and shows the cast at once. */
  private reducedFlash = false;
  private flashButton!: Phaser.GameObjects.Text;
  private flashBorder!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Title');
  }

  create(): void {
    // The scene object is reused when a game goes back to the title.
    this.elapsed = 0;
    this.starting = false;
    this.castRows = [];
    this.heroes = [];
    this.opponents = [];
    this.highScore = loadHighScore();
    this.reducedFlash = loadReducedFlash();
    makeTextures(this);

    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: NEON.hud };
    const logo = this.add
      .text(GAME_WIDTH / 2, 3.5 * TILE_SIZE, 'WAKA-WAKA', {
        ...style,
        fontSize: `${TITLE.logoSize}px`,
      })
      .setOrigin(0.5);
    // A hard pink offset, like the wall outlines, rather than a blur.
    logo.setShadow(2, 2, cssColour(NEON.wallLine), 0, false, true);
    this.add
      .text(GAME_WIDTH / 2, 5.75 * TILE_SIZE, `HI ${String(this.highScore).padStart(6, '0')}`, {
        ...style,
        color: NEON.hudDim,
      })
      .setOrigin(0.5);

    this.drawCast();
    this.drawHelp();
    this.prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 3.5 * TILE_SIZE, 'PRESS A KEY OR TAP TO PLAY', {
        ...style,
        color: NEON.ready,
      })
      .setOrigin(0.5);
    // A bordered button, big enough to tap, for the reduced-flash setting.
    this.flashBorder = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 1.5 * TILE_SIZE, 1, 1);
    this.flashButton = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 1.5 * TILE_SIZE, '', {
        ...style,
        color: NEON.hudDim,
        padding: { x: TITLE.buttonPadding, y: TITLE.buttonPadding },
      })
      .setOrigin(0.5);
    this.showFlashButton();
    this.setUpInput();
    this.update(0, 0);
  }

  override update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs / 1000;
    const view = titleView(this.elapsed, CAST.length, this.reducedFlash);
    this.castPage.setVisible(view.page === 'cast');
    this.castRows.forEach((row, i) => row.setVisible(i < view.castShown));
    this.helpPage.setVisible(view.page === 'help');
    this.prompt.setVisible(view.promptLit);

    const chomp = Math.floor(this.elapsed * HERO.chompHz) % HERO_MOUTH_FRAMES.length;
    for (const img of this.heroes) img.setTexture(heroTexture('right', chomp));
    const frame = Math.floor(this.elapsed * OPPONENT_ART.frameHz) % OPPONENT_ART.frames;
    for (const { img, who } of this.opponents) img.setTexture(opponentTexture(who, 'right', frame));
  }

  snapshot(): TitleSnapshot {
    const { page, castShown } = titleView(this.elapsed, CAST.length, this.reducedFlash);
    return {
      page,
      castShown,
      takesInput: titleTakesInput(this.elapsed),
      highScore: this.highScore,
      reducedFlash: this.reducedFlash,
    };
  }

  private drawCast(): void {
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px` };
    const top = 8.75 * TILE_SIZE;
    this.castRows = CAST.map(({ who, name, line }, i) => {
      const y = top + i * TITLE.rowGap;
      const colour = who === 'hero' ? NEON.hero : (NEON.opponents[who] ?? NEON.hero);
      const img =
        who === 'hero'
          ? this.add.image(0, 0, heroTexture('right', 1))
          : this.add.image(0, 0, opponentTexture(who, 'right', 0));
      if (who === 'hero') this.heroes.push(img);
      else this.opponents.push({ img, who });
      const label = this.add
        .text(1.5 * TILE_SIZE, -6, name, { ...style, color: cssColour(colour) })
        .setOrigin(0, 0.5);
      const text = this.add
        .text(1.5 * TILE_SIZE, 6, line, { ...style, color: NEON.hudDim })
        .setOrigin(0, 0.5);
      return this.add.container(4 * TILE_SIZE, y, [img, label, text]);
    });
    this.castPage = this.add.container(0, 0, this.castRows);
  }

  private drawHelp(): void {
    const style = { fontFamily: HUD.font, fontSize: `${HUD.fontSize}px`, color: NEON.hud };
    const dim = { ...style, color: NEON.hudDim };
    const middle = GAME_WIDTH / 2;
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.text(middle, 8.25 * TILE_SIZE, 'HOW TO PLAY', { ...style, color: NEON.ready }),
      this.add.text(middle, 9.75 * TILE_SIZE, 'ARROWS, WASD, SWIPE OR STICK', style),
      this.add.text(middle, 10.75 * TILE_SIZE, 'P OR ESC PAUSES', dim),
    ];
    for (const p of parts) (p as Phaser.GameObjects.Text).setOrigin(0.5);

    const [first, second, third, last] = SCORE.eaten;
    const rows = [
      { texture: DOT_TEXTURE, text: `${SCORE.dot} A DOT` },
      { texture: PELLET_TEXTURE, text: `${SCORE.pellet} A PELLET: THEY GET SCARED` },
      { texture: scaredTexture(0, 'scared', 0), text: `${first} ${second} ${third} ${last}` },
      {
        texture: batteryTexture(BATTERY_FRAMES - 1),
        text: `BATTERY ${levelRow(1).bonusPoints} AND UP`,
      },
      { texture: heroTexture('right', 1), text: `EXTRA LIFE AT ${ROUND.extraLifeAt}` },
    ];
    const top = 13 * TILE_SIZE;
    rows.forEach(({ texture, text }, i) => {
      const y = top + i * TITLE.helpRowGap;
      parts.push(
        this.add.image(4 * TILE_SIZE, y, texture),
        this.add.text(5.5 * TILE_SIZE, y, text, style).setOrigin(0, 0.5),
      );
    });
    this.helpPage = this.add.container(0, 0, parts);
  }

  private setUpInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input is not available');
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    // Phaser re-sends a frame's earlier key events when another key arrives in
    // the same frame, so handle each once: F must not switch twice.
    const handled = new WeakSet<KeyboardEvent>();
    const onKey = (e: KeyboardEvent): void => {
      if (handled.has(e)) return;
      handled.add(e);
      if (e.repeat || IGNORED_KEYS.has(e.code)) return;
      if (e.code === FLASH_KEY) this.toggleReducedFlash();
      else this.startGame();
    };
    kb.on('keydown', onKey);

    // A tap or click anywhere on the game's part of the page, canvas or not;
    // on the reduced-flash button it switches that instead.
    const root = document.getElementById('game');
    const onDown = (e: PointerEvent): void => {
      if (this.onFlashButton(e)) this.toggleReducedFlash();
      else this.startGame();
    };
    root?.addEventListener('pointerdown', onDown);
    const removeRotatePrompt = createRotatePrompt(() => undefined);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', onKey);
      root?.removeEventListener('pointerdown', onDown);
      removeRotatePrompt();
    });
  }

  /** Whether a pointer event is over the reduced-flash button, in game pixels. */
  private onFlashButton(e: PointerEvent): boolean {
    const rect = this.game.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const x = ((e.clientX - rect.left) * GAME_WIDTH) / rect.width;
    const y = ((e.clientY - rect.top) * GAME_HEIGHT) / rect.height;
    return this.flashButton.getBounds().contains(x, y);
  }

  private toggleReducedFlash(): void {
    this.reducedFlash = !this.reducedFlash;
    storeReducedFlash(this.reducedFlash);
    this.showFlashButton();
  }

  private showFlashButton(): void {
    this.flashButton
      .setText(`F  REDUCED FLASH: ${this.reducedFlash ? 'ON' : 'OFF'}`)
      .setColor(this.reducedFlash ? NEON.hud : NEON.hudDim);
    const { width, height } = this.flashButton;
    this.flashBorder
      .setSize(width, height)
      .setStrokeStyle(1, this.reducedFlash ? NEON.hero : NEON.wallGlow);
  }

  private startGame(): void {
    if (this.starting || !titleTakesInput(this.elapsed)) return;
    this.starting = true;
    this.scene.start('Game');
  }
}
