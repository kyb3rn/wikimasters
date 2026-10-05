import { describe, expect, it } from 'vitest';
import { parseFriendsSort, sortFriends } from '@/services/friends';

interface Friend {
  readonly username: string;
  readonly time: number | undefined;
}

const FRIENDS: readonly Friend[] = [
  { username: 'Poloz30', time: 300 },
  { username: 'aelonka', time: 100 },
  { username: 'Norband', time: undefined },
  { username: 'Élodie', time: 300 },
  { username: 'AlakazM', time: 200 },
];

const timeOf = (friend: Friend) => friend.time;
const names = (friends: readonly Friend[]) => friends.map((friend) => friend.username);

describe('tri des amis', () => {
  it('par nom, sans casse ni accents, dans les deux sens', () => {
    expect(names(sortFriends(FRIENDS, { sort: 'name', order: 'asc' }, timeOf))).toEqual(['aelonka', 'AlakazM', 'Élodie', 'Norband', 'Poloz30']);
    expect(names(sortFriends(FRIENDS, { sort: 'name', order: 'desc' }, timeOf))).toEqual(['Poloz30', 'Norband', 'Élodie', 'AlakazM', 'aelonka']);
  });

  it('par date d’amitié : dates égales par nom, sans date à la fin dans les deux sens', () => {
    expect(names(sortFriends(FRIENDS, { sort: 'date', order: 'desc' }, timeOf))).toEqual(['Élodie', 'Poloz30', 'AlakazM', 'aelonka', 'Norband']);
    expect(names(sortFriends(FRIENDS, { sort: 'date', order: 'asc' }, timeOf))).toEqual(['aelonka', 'AlakazM', 'Élodie', 'Poloz30', 'Norband']);
  });

  it('ne touche pas à la liste reçue', () => {
    const before = names(FRIENDS);
    sortFriends(FRIENDS, { sort: 'name', order: 'asc' }, timeOf);
    sortFriends(FRIENDS, { sort: 'date', order: 'asc' }, timeOf);
    expect(names(FRIENDS)).toEqual(before);
  });
});

describe('tri lu dans le stockage', () => {
  it('lu tel quel ; sens illisible : celui du tri ; tri inconnu : rien', () => {
    expect(parseFriendsSort({ sort: 'date', order: 'asc' })).toEqual({ sort: 'date', order: 'asc' });
    expect(parseFriendsSort({ sort: 'date' })).toEqual({ sort: 'date', order: 'desc' });
    expect(parseFriendsSort({ sort: 'name', order: 'haut' })).toEqual({ sort: 'name', order: 'asc' });
    expect(parseFriendsSort({ sort: 'recent', order: 'asc' })).toBeUndefined();
    expect(parseFriendsSort('name')).toBeUndefined();
  });
});
