import { NEON, WALL_ART } from '../config/tuning';
import { TILE, type Maze } from '../logic/maze';

/** RGBA pixels, ready for a canvas ImageData. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

const isWallTile = (c: string | undefined): boolean => c === TILE.wall || c === TILE.houseWall;

/**
 * Draws the Neon Arcade walls for a maze (WW-04): rounded neon outlines with a
 * soft glow, made from each wall pixel's distance to the nearest corridor pixel.
 * Outside the maze counts as wall, except beyond the tunnel's two ends.
 */
export function drawWalls(maze: Maze, tileSize: number): Pixels {
  const w = maze.width * tileSize;
  const h = maze.height * tileSize;
  const wall = new Uint8Array(w * h);
  for (let ty = 0; ty < maze.height; ty++) {
    for (let tx = 0; tx < maze.width; tx++) {
      if (!isWallTile(maze.grid[ty]?.[tx])) continue;
      for (let y = 0; y < tileSize; y++) {
        const row = (ty * tileSize + y) * w + tx * tileSize;
        wall.fill(1, row, row + tileSize);
      }
    }
  }

  const R = WALL_ART.radius;
  const offsets: [number, number, number][] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= R) offsets.push([dx, dy, d]);
    }
  }
  offsets.sort((a, b) => a[2] - b[2]);

  const tunnelTop = maze.tunnelY * tileSize;
  const tunnelBottom = tunnelTop + tileSize;
  const wallAt = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return !(y >= tunnelTop && y < tunnelBottom);
    return wall[y * w + x] === 1;
  };

  // Distance from each wall pixel to the nearest corridor pixel, capped at R + 1.
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!wall[y * w + x]) continue;
      let d = R + 1;
      for (const [dx, dy, od] of offsets) {
        if (!wallAt(x + dx, y + dy)) {
          d = od;
          break;
        }
      }
      dist[y * w + x] = d;
    }
  }

  const data = new Uint8ClampedArray(w * h * 4);
  const put = (i: number, rgb: number): void => {
    data[i * 4] = (rgb >> 16) & 0xff;
    data[i * 4 + 1] = (rgb >> 8) & 0xff;
    data[i * 4 + 2] = rgb & 0xff;
    data[i * 4 + 3] = 255;
  };
  const inner = (x: number, y: number): boolean =>
    x >= 0 && x < w && y >= 0 && y < h && (dist[y * w + x] as number) > WALL_ART.lineAt;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = dist[i] as number;
      let colour: number = NEON.background;
      if (d > WALL_ART.lineAt) {
        // The outline is the inner region's edge, so it follows every corner smoothly.
        const edge = !inner(x + 1, y) || !inner(x - 1, y) || !inner(x, y + 1) || !inner(x, y - 1);
        const onScreenEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        colour =
          edge && !onScreenEdge
            ? NEON.wallLine
            : d > WALL_ART.fillFrom
              ? NEON.wallFill
              : NEON.wallGlow;
      } else if (d > WALL_ART.glowFrom) {
        colour = NEON.wallGlow;
      }
      put(i, colour);
    }
  }

  // The ghost-house door: a thin pink bar across each door tile.
  const t = WALL_ART.doorThickness;
  for (let tx = 0; tx < maze.width; tx++) {
    for (let ty = 0; ty < maze.height; ty++) {
      if (maze.grid[ty]?.[tx] !== TILE.door) continue;
      const y0 = ty * tileSize + Math.floor((tileSize - t) / 2);
      for (let y = y0; y < y0 + t; y++) {
        for (let x = tx * tileSize; x < (tx + 1) * tileSize; x++) put(y * w + x, NEON.door);
      }
    }
  }

  return { width: w, height: h, data };
}
