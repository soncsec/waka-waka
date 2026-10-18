/** Tile characters in a maze grid. */
export const TILE = {
  wall: '#',
  dot: '.',
  pellet: 'o',
  /** Corridor with nothing to eat. */
  empty: ' ',
  houseWall: '=',
  door: '-',
  houseFloor: 'h',
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

export interface Point {
  x: number;
  y: number;
}

export interface Maze {
  /** Seed that produced this maze (for the fallback maze, the seed that was asked for). */
  seed: number;
  width: number;
  height: number;
  /** One string per row, `width` characters each, using TILE characters. */
  grid: readonly string[];
  /** Hero start: centred between two tiles, so `x` ends in .5. */
  start: Point;
  /** Ghost house rectangle in tiles (inclusive), walls included. */
  house: { x0: number; x1: number; y0: number; y1: number };
  /** Row whose left and right edges wrap around. */
  tunnelY: number;
}

/** Corridor tiles the hero can walk on (the house is for opponents only). */
export function isWalkable(c: string | undefined): boolean {
  return c === TILE.dot || c === TILE.pellet || c === TILE.empty;
}
