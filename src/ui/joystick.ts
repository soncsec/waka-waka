import { JOYSTICK } from '../config/tuning';
import { knobOffset, stickDirection } from '../logic/joystick';
import type { Dir } from '../logic/movement';

export interface JoystickHandlers {
  /** A thumb came down. Return true if the touch was used up (to resume or restart), so it doesn't steer. */
  onTouch(): boolean;
  /** The stick points a new way. */
  onDir(dir: Dir): void;
}

/**
 * The floating joystick (M4.1, WW-06). A touch on `root` outside the game canvas
 * shows a stick under the thumb; moving the thumb steers. Swipes on the canvas
 * still work. Mouse and pen are ignored, so desktop players never see it.
 * Returns a function that removes it.
 */
export function createJoystick(root: HTMLElement, handlers: JoystickHandlers): () => void {
  const size = 2 * JOYSTICK.radius;
  const base = document.createElement('div');
  base.className = 'joystick';
  base.style.width = `${size}px`;
  base.style.height = `${size}px`;
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  knob.style.width = `${JOYSTICK.knobSize}px`;
  knob.style.height = `${JOYSTICK.knobSize}px`;
  base.append(knob);
  root.append(base);

  let active: { id: number; x: number; y: number; steer: boolean } | null = null;
  let last: Dir | null = null;

  const placeKnob = (dx: number, dy: number): void => {
    const k = knobOffset(dx, dy, JOYSTICK.radius);
    const c = (size - JOYSTICK.knobSize) / 2;
    knob.style.transform = `translate(${c + k.x}px, ${c + k.y}px)`;
  };

  const down = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' || active || e.target instanceof HTMLCanvasElement) return;
    e.preventDefault();
    active = { id: e.pointerId, x: e.clientX, y: e.clientY, steer: !handlers.onTouch() };
    last = null;
    base.style.transform = `translate(${e.clientX - size / 2}px, ${e.clientY - size / 2}px)`;
    placeKnob(0, 0);
    base.classList.add('joystick-on');
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      // Not capturable (e.g. a synthetic event): moves over the canvas still reach `root`.
    }
  };
  const move = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.id) return;
    const dx = e.clientX - active.x;
    const dy = e.clientY - active.y;
    placeKnob(dx, dy);
    if (!active.steer) return;
    const dir = stickDirection(dx, dy, JOYSTICK.deadZone);
    if (dir && dir !== last) handlers.onDir(dir);
    last = dir ?? last;
  };
  const up = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.id) return;
    active = null;
    base.classList.remove('joystick-on');
  };

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  return () => {
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    base.remove();
  };
}
