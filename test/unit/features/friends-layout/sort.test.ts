import { describe, expect, it } from 'vitest';
import { sortDetails } from '@/features/friends-layout/sort';

describe('tri retenu de la page Amis', () => {
  it('fenêtre Mémoire : le tri, puis son sens', () => {
    expect(sortDetails({ sort: 'date', order: 'desc' })).toEqual(["Tri : Date d'amitié", 'Des plus récents aux plus anciens']);
    expect(sortDetails({ sort: 'name', order: 'asc' })).toEqual(['Tri : Nom', 'De A à Z']);
  });
});
