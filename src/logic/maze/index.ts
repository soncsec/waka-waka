import { MAZE } from '../../config/tuning';
import { mixSeed } from '../rng';
import { fallbackMaze } from './fallback';
import { generateMaze } from './generate';
import type { Maze } from './types';
import { validateMaze } from './validate';

export { generateMaze, MAZE_HEIGHT, MAZE_WIDTH } from './generate';
export { fallbackMaze } from './fallback';
export { validateMaze, type MazeCheck, type MazeStats } from './validate';
export { isWalkable, TILE, type Maze, type Point, type TileChar } from './types';

export interface BuiltMaze {
  maze: Maze;
  /** Generation attempts used (MAZE.maxAttempts when the fallback was used). */
  attempts: number;
  usedFallback: boolean;
}

/**
 * The maze for maze number `level` (1, 2, 3, ...) of the run with seed `runSeed`.
 * The same run seed always gives the same mazes. A maze that fails validation is
 * generated again from the next seed; after MAZE.maxAttempts failures the
 * built-in maze is used (WW-03).
 */
export function buildMaze(
  runSeed: number,
  level: number,
  generate: (seed: number) => Maze = generateMaze,
): BuiltMaze {
  const levelSeed = mixSeed(runSeed, level);
  for (let attempt = 0; attempt < MAZE.maxAttempts; attempt++) {
    const maze = generate(attempt === 0 ? levelSeed : mixSeed(levelSeed, attempt));
    if (validateMaze(maze).ok) return { maze, attempts: attempt + 1, usedFallback: false };
  }
  return { maze: fallbackMaze(levelSeed), attempts: MAZE.maxAttempts, usedFallback: true };
}
