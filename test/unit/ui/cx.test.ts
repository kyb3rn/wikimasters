import { describe, expect, it } from 'vitest';
import { cx } from '@/ui/cx';

describe('cx', () => {
  it('joint les classes, sans les valeurs vides ou fausses', () => {
    const busy = false as boolean;
    expect(cx('a', busy && 'b', undefined, null, '', 'c')).toBe('a c');
    expect(cx()).toBe('');
  });
});
