import { describe, expect, it } from 'vitest';
import { drawWalls } from '../../src/art/walls';
import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, NEON, TILE_SIZE } from '../../src/config/tuning';
import { fallbackMaze, MAZE_HEIGHT, MAZE_WIDTH, TILE } from '../../src/logic/maze';

const rgb = (data: Uint8ClampedArray, w: number, x: number, y: number): number => {
  const i = (y * w + x) * 4;
  return ((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number);
};

describe('screen size', () => {
  it('fits the maze plus a HUD bar above and below (WW-05)', () => {
    expect(GAME_WIDTH).toBe(MAZE_WIDTH * TILE_SIZE);
    expect(GAME_HEIGHT).toBe(MAZE_HEIGHT * TILE_SIZE + 2 * HUD_HEIGHT);
    expect([GAME_WIDTH, GAME_HEIGHT]).toEqual([384, 464]);
  });
});

describe('drawWalls', () => {
  const maze = fallbackMaze(1);
  const art = drawWalls(maze, TILE_SIZE);
  const at = (x: number, y: number): number => rgb(art.data, art.width, x, y);
  const centre = (tx: number, ty: number): [number, number] => [
    tx * TILE_SIZE + TILE_SIZE / 2,
    ty * TILE_SIZE + TILE_SIZE / 2,
  ];

  it('covers the whole maze with opaque pixels', () => {
    expect([art.width, art.height]).toEqual([384, 432]);
    for (let i = 3; i < art.data.length; i += 4) expect(art.data[i]).toBe(255);
  });

  it('leaves corridors as background and draws a neon outline beside them', () => {
    // Tile (1,1) is a corridor; tile (2,2) is the thick wall below-right of it.
    const [cx, cy] = centre(1, 1);
    expect(at(cx, cy)).toBe(NEON.background);
    const colours = new Set<number>();
    for (let y = 2 * TILE_SIZE; y < 3 * TILE_SIZE; y++) colours.add(at(cx + TILE_SIZE, y));
    expect(colours).toContain(NEON.wallLine);
    expect(colours).toContain(NEON.wallGlow);
  });

  it('fills the inside of thick walls', () => {
    // Tiles 2-6 on rows 2-3 form a wide wall block.
    const [x, y] = centre(4, 2);
    expect(at(x, y + TILE_SIZE / 2)).toBe(NEON.wallFill);
  });

  it('draws the ghost-house door as a pink bar', () => {
    const doorX = maze.grid[maze.house.y0]?.indexOf(TILE.door) as number;
    expect(doorX).toBeGreaterThan(0);
    const [x, y] = centre(doorX, maze.house.y0);
    expect(at(x, y)).toBe(NEON.door);
  });

  it('leaves the tunnel open at the screen edge', () => {
    const [, y] = centre(0, maze.tunnelY);
    expect(at(0, y)).toBe(NEON.background);
    expect(at(art.width - 1, y)).toBe(NEON.background);
  });

  it('is mirror-symmetric like the maze', () => {
    for (let y = 0; y < art.height; y += 7) {
      for (let x = 0; x < art.width / 2; x += 5) expect(at(x, y)).toBe(at(art.width - 1 - x, y));
    }
  });
});
