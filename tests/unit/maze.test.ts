import { describe, expect, it } from 'vitest';
import { MAZE } from '../../src/config/tuning';
import {
  buildMaze,
  fallbackMaze,
  generateMaze,
  MAZE_HEIGHT,
  MAZE_WIDTH,
  TILE,
  validateMaze,
  type Maze,
} from '../../src/logic/maze';

/** Copy of a maze with tiles changed; `mirror` also changes the mirrored tile. */
function edit(maze: Maze, changes: [number, number, string][], mirror = true): Maze {
  const rows = maze.grid.map((r) => r.split(''));
  for (const [x, y, c] of changes) {
    (rows[y] as string[])[x] = c;
    if (mirror) (rows[y] as string[])[maze.width - 1 - x] = c;
  }
  return { ...maze, grid: rows.map((r) => r.join('')) };
}

/** A small hand-drawn maze, for checks that don't depend on the full layout. */
function tiny(grid: string[]): Maze {
  return {
    seed: 0,
    width: (grid[0] as string).length,
    height: grid.length,
    grid,
    start: { x: 1.5, y: 1 },
    house: { x0: 0, x1: 0, y0: 0, y1: 0 },
    tunnelY: -1,
  };
}

const problemsOf = (maze: Maze): string => validateMaze(maze).problems.join('\n');

describe('generateMaze', () => {
  it('is 24 x 27 tiles', () => {
    const m = generateMaze(1);
    expect([MAZE_WIDTH, MAZE_HEIGHT]).toEqual([24, 27]);
    expect(m.grid).toHaveLength(27);
    expect(m.grid.every((r) => r.length === 24)).toBe(true);
  });

  it('gives the same maze for the same seed and different mazes for different seeds', () => {
    expect(generateMaze(42).grid).toEqual(generateMaze(42).grid);
    const distinct = new Set(Array.from({ length: 50 }, (_, s) => generateMaze(s).grid.join('')));
    expect(distinct.size).toBe(50);
  });

  it('closes fewer corridors when asked for a lower close ratio', () => {
    const open = validateMaze(generateMaze(3, { closeRatio: 0 }));
    const normal = validateMaze(generateMaze(3));
    expect(open.ok).toBe(true);
    expect(open.stats.dots).toBeGreaterThan(normal.stats.dots);
  });

  it('passes every check for 1,500 seeds, with no stretch over 10 tiles', () => {
    let longest = 0;
    for (let seed = 0; seed < 1500; seed++) {
      const check = validateMaze(generateMaze(seed * 7919));
      expect(check.problems, `seed ${seed * 7919}`).toEqual([]);
      longest = Math.max(longest, check.stats.longestStretch);
    }
    expect(longest).toBeLessThanOrEqual(MAZE.maxStretchTiles);
  }, 60_000);
});

describe('buildMaze', () => {
  it('gives each maze of a run its own repeatable layout', () => {
    const a = buildMaze(123, 1).maze.grid.join('');
    expect(buildMaze(123, 1).maze.grid.join('')).toBe(a);
    expect(buildMaze(123, 2).maze.grid.join('')).not.toBe(a);
    expect(buildMaze(124, 1).maze.grid.join('')).not.toBe(a);
  });

  it('never needs the fallback across 200 runs of 5 mazes', () => {
    for (let run = 0; run < 200; run++) {
      for (let level = 1; level <= 5; level++) {
        const built = buildMaze(run, level);
        expect(built.usedFallback).toBe(false);
        expect(built.attempts).toBe(1);
      }
    }
  }, 60_000);

  it('retries with a new seed when a maze fails the checks', () => {
    const seeds: number[] = [];
    const flaky = (seed: number): Maze => {
      seeds.push(seed);
      return seeds.length < 3 ? edit(generateMaze(seed), [[1, 1, 'x']]) : generateMaze(seed);
    };
    const built = buildMaze(9, 1, flaky);
    expect(built.attempts).toBe(3);
    expect(built.usedFallback).toBe(false);
    expect(new Set(seeds).size).toBe(3);
  });

  it('uses the built-in maze after the maximum number of failures', () => {
    let calls = 0;
    const broken = (seed: number): Maze => {
      calls++;
      return edit(generateMaze(seed), [[1, 1, 'x']]);
    };
    const built = buildMaze(9, 1, broken);
    expect(calls).toBe(MAZE.maxAttempts);
    expect(built.usedFallback).toBe(true);
    expect(built.maze.grid).toEqual(fallbackMaze(0).grid);
  });
});

describe('fallbackMaze', () => {
  it('passes every check', () => {
    expect(validateMaze(fallbackMaze(1)).problems).toEqual([]);
  });
});

describe('validateMaze', () => {
  const base = fallbackMaze(1);

  it('reports useful stats', () => {
    const { stats } = validateMaze(base);
    expect(stats.pellets).toBe(4);
    expect(stats.dots).toBeGreaterThan(150);
    expect(stats.junctions).toBeGreaterThan(10);
    expect(stats.longestStretch).toBeGreaterThan(0);
  });

  it('rejects a stretch of more than 10 tiles, counted around corners', () => {
    // A ring of 12 tiles: every tile has exactly 2 ways out.
    const ring = tiny(['#######', '#.....#', '#.###.#', '#.....#', '#######']);
    expect(validateMaze(ring).stats.longestStretch).toBe(12);
    expect(problemsOf(ring)).toContain('stretch of 12 tiles');
    // A ring of 10 tiles is allowed.
    const ten = tiny(['######', '#....#', '#.##.#', '#....#', '######']);
    expect(validateMaze(ten).stats.longestStretch).toBe(10);
    expect(problemsOf(ten)).not.toContain('stretch');
  });

  it('rejects dead ends', () => {
    expect(problemsOf(tiny(['#####', '#...#', '#####']))).toContain('dead end at 1,1');
  });

  it('rejects corridors wider than one tile', () => {
    expect(problemsOf(edit(base, [[11, 3, '.']]))).toContain('wider than one tile');
  });

  it('rejects tiles that cannot be reached from the start', () => {
    expect(problemsOf(edit(base, [[5, 11, '.']]))).toContain('cannot be reached');
  });

  it('rejects a maze that is not mirror-symmetric', () => {
    expect(problemsOf(edit(base, [[1, 1, ' ']], false))).toContain('not mirror-symmetric at 1,1');
  });

  it('rejects the wrong number of power pellets', () => {
    expect(problemsOf(edit(base, [[1, 2, '.']]))).toContain('2 power pellets');
  });

  it('rejects openings in the border other than the tunnel', () => {
    expect(problemsOf(edit(base, [[5, 0, '.']]))).toContain('open border at 5,0');
  });

  it('rejects unknown tiles and the wrong size', () => {
    expect(problemsOf(edit(base, [[1, 1, 'x']]))).toContain("unknown tile 'x'");
    expect(problemsOf({ ...base, grid: base.grid.slice(1) })).toContain('grid is not 24x27');
  });

  it('rejects a start that is not on a corridor', () => {
    expect(problemsOf({ ...base, start: { x: 0.5, y: 0 } })).toContain('hero start');
  });

  it('rejects a broken ghost house', () => {
    expect(problemsOf(edit(base, [[11, 11, TILE.houseWall]]))).toContain('no door');
    expect(problemsOf(edit(base, [[9, 12, TILE.houseWall]]))).toContain("house tile '='");
    const lowDoor = edit(base, [[11, 15, TILE.door]]);
    expect(problemsOf(lowDoor)).toContain('is not on top');
  });

  it('rejects a maze with no dots', () => {
    const empty = { ...base, grid: base.grid.map((r) => r.replaceAll('.', ' ')) };
    expect(problemsOf(empty)).toContain('no dots');
  });
});
