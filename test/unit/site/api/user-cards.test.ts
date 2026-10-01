import { describe, expect, it } from 'vitest';
import { readDiscard } from '@/site/api';
import { netRequest } from '../../support';

describe('readDiscard', () => {
  it('lit l’exemplaire défaussé, décodé', () => {
    expect(readDiscard(netRequest('/api/user-cards/u%201/discard', { method: 'POST' }))).toEqual({ userCardId: 'u 1' });
  });

  it('ni une lecture, ni une autre route des exemplaires', () => {
    expect(readDiscard(netRequest('/api/user-cards/u1/discard'))).toBeUndefined();
    expect(readDiscard(netRequest('/api/user-cards/bulk-discard', { method: 'POST' }))).toBeUndefined();
  });
});
