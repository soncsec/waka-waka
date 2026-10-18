import { describe, expect, it } from 'vitest';
import { swipeDirection } from '../../src/logic/swipe';

describe('swipeDirection', () => {
  it('ignores short movements', () => {
    expect(swipeDirection(5, 5, 10)).toBeNull();
  });

  it('picks the longer axis', () => {
    expect(swipeDirection(20, 5, 10)).toBe('right');
    expect(swipeDirection(-20, 5, 10)).toBe('left');
    expect(swipeDirection(3, 20, 10)).toBe('down');
    expect(swipeDirection(3, -20, 10)).toBe('up');
  });

  it('treats an exact diagonal as horizontal', () => {
    expect(swipeDirection(10, 10, 10)).toBe('right');
  });
});
