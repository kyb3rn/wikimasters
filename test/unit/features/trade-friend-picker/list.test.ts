import { describe, expect, it } from 'vitest';
import { DEFAULT_CHOICES, pickFriends } from '@/features/trade-friend-picker/list';
import type { PickerFriend } from '@/site/trades';

const friend = (id: string, username: string): PickerFriend => ({ id, username, avatarUrl: undefined, avatarPosX: 50, avatarPosY: 50, raw: { id, username } });
const friends = [friend('a', 'Zoé'), friend('b', 'élodie'), friend('c', 'Marc'), friend('d', 'Aline')];
const dates = new Map([
  ['a', 3],
  ['b', 1],
  ['c', 2],
]);
const names = (list: readonly PickerFriend[]) => list.map((f) => f.username);

describe('pickFriends', () => {
  it('par nom par défaut, sans tenir compte des accents ni de la casse', () => {
    expect(names(pickFriends(friends, DEFAULT_CHOICES, undefined, dates))).toEqual(['Aline', 'élodie', 'Marc', 'Zoé']);
  });

  it('recherche dans le pseudo, sans accents ni casse', () => {
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, query: 'ELO' }, undefined, dates))).toEqual(['élodie']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, query: 'zoe' }, undefined, dates))).toEqual(['Zoé']);
  });

  it('échange en cours ou non ; échanges inconnus : pas de filtre', () => {
    const pending = new Set(['c']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'pending' }, pending, dates))).toEqual(['Marc']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'free' }, pending, dates))).toEqual(['Aline', 'élodie', 'Zoé']);
    expect(pickFriends(friends, { ...DEFAULT_CHOICES, filter: 'pending' }, undefined, dates)).toHaveLength(4);
  });

  it('par date d’amitié, les dates inconnues à la fin', () => {
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, sort: 'recent' }, undefined, dates))).toEqual(['Zoé', 'Marc', 'élodie', 'Aline']);
    expect(names(pickFriends(friends, { ...DEFAULT_CHOICES, sort: 'old' }, undefined, dates))).toEqual(['élodie', 'Marc', 'Zoé', 'Aline']);
  });
});
