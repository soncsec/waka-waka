/**
 * Largest whole-number zoom at which the game still fits the window.
 * Whole numbers keep every art pixel the same size on screen (no blurry or uneven pixels).
 * Never below 1, even if the window is smaller than the game.
 */
export function integerZoom(
  viewWidth: number,
  viewHeight: number,
  gameWidth: number,
  gameHeight: number,
): number {
  if (gameWidth <= 0 || gameHeight <= 0) throw new RangeError('game size must be positive');
  const fit = Math.min(viewWidth / gameWidth, viewHeight / gameHeight);
  return Number.isFinite(fit) ? Math.max(1, Math.floor(fit)) : 1;
}

/**
 * Whether to ask the player to turn the device upright (WW-05): the screen is
 * landscape, the game does not fit at zoom 1, but it would fit turned to portrait.
 * Decided by size, not device type, so tablets (which fit either way) never see it.
 */
export function needsRotate(
  viewWidth: number,
  viewHeight: number,
  gameWidth: number,
  gameHeight: number,
): boolean {
  if (viewWidth <= viewHeight) return false;
  const fits = viewWidth >= gameWidth && viewHeight >= gameHeight;
  const fitsUpright = viewHeight >= gameWidth && viewWidth >= gameHeight;
  return !fits && fitsUpright;
}
