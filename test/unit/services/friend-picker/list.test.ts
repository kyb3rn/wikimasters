import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICES, pickFriends } from '@/services/friend-picker/list';
import type { Player } from '@/site/api';

const friend = (id: string, username: string): Player => ({ id, username, avatarUrl: undefined, avatarPosX: 50, avatarPosY: 50 });
const friends = [friend('a', 'Zoé'), friend('b', 'élodie'), friend('c', 'Marc'), friend('d', 'Aline')];
const dates = new Map([
  ['a', 3],
  ['b', 1],
  ['c', 2],
]);
const names = (list: readonly Player[]) => list.map((f) => f.username);

describe('pickFriends', () => {
  it('par nom par défaut, sans tenir compte des accents ni de la casse', () => {
    expect(names(pickFriends(friends, DEFAULT_CHOICES, undefined, dates))).toEqual(['Aline', 'élodie', 'Marc', 'Zoé']);
  });

  it('recherche dans le pseudo, sans accents ni casse', () => {
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, query: 'ELO' }, undefined, dates))).toEqual(['élodie']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, query: 'zoe' }, undefined, dates))).toEqual(['Zoé']);
  });

  it('marqués (échange en cours) ou non ; marque inconnue : pas de filtre', () => {
    const pending = new Set(['c']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'with' }, pending, dates))).toEqual(['Marc']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'without' }, pending, dates))).toEqual(['Aline', 'élodie', 'Zoé']);
    expect(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'with' }, undefined, dates)).toHaveLength(4);
  });

  it('par nom de Z à A ; par date d’amitié dans les deux sens, les dates inconnues à la fin', () => {
    const sorted = (sort: 'name' | 'date', order: 'asc' | 'desc') => names(pickFriends(friends, { ...DEFAULT_CHOICES, sort: { sort, order } }, undefined, dates));
    expect(sorted('name', 'desc')).toEqual(['Zoé', 'Marc', 'élodie', 'Aline']);
    expect(sorted('date', 'desc')).toEqual(['Zoé', 'Marc', 'élodie', 'Aline']);
    expect(sorted('date', 'asc')).toEqual(['élodie', 'Marc', 'Zoé', 'Aline']);
  });
});
