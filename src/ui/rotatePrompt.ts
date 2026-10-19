import { GAME_HEIGHT, GAME_WIDTH } from '../config/tuning';
import { needsRotate } from '../logic/scaling';

/**
 * The "turn your phone upright" prompt (M4.2, WW-05): a full-screen notice shown
 * while a phone is held landscape. `onShow` runs each time it appears, so the
 * game can pause. Returns a function that removes it.
 */
export function createRotatePrompt(onShow: () => void): () => void {
  const prompt = document.createElement('div');
  prompt.className = 'rotate-prompt';
  prompt.textContent = 'TURN YOUR PHONE UPRIGHT TO PLAY';
  document.body.append(prompt);

  let shown = false;
  const check = (): void => {
    const show = needsRotate(window.innerWidth, window.innerHeight, GAME_WIDTH, GAME_HEIGHT);
    prompt.classList.toggle('rotate-on', show);
    if (show && !shown) onShow();
    shown = show;
  };
  check();
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  return () => {
    window.removeEventListener('resize', check);
    window.removeEventListener('orientationchange', check);
    prompt.remove();
  };
}
