import { describe, expect, it } from 'vitest';
import { groupLinks, type GroupItem } from '@/features/dms-groups/groups';

const own = (at: number | undefined): GroupItem => ({ sender: 'me', at });
const peer = (at: number | undefined): GroupItem => ({ sender: 'peer', at });
const from = (sender: string, at: number): GroupItem => ({ sender, at });
const s = (seconds: number) => seconds * 1000;

const shape = (items: GroupItem[]) => groupLinks(items).map(({ prev, next }) => `${prev ? '<' : '.'}${next ? '>' : '.'}`).join(' ');

describe('groupLinks', () => {
  it('groupe les messages du même auteur à moins d’une minute l’un de l’autre, de proche en proche', () => {
    expect(shape([own(s(0)), own(s(50)), own(s(100)), own(s(170))])).toBe('.> <> <. ..');
  });

  it('une minute pile ne groupe plus', () => {
    expect(shape([peer(s(0)), peer(s(60))])).toBe('.. ..');
    expect(shape([peer(s(0)), peer(s(59.999))])).toBe('.> <.');
  });

  it('un autre auteur, un échange ou une date inconnue coupe le groupe', () => {
    expect(shape([own(s(0)), peer(s(1)), peer(s(2))])).toBe('.. .> <.');
    expect(shape([own(s(0)), undefined, own(s(2))])).toBe('.. .. ..');
    expect(shape([own(s(0)), own(undefined), own(s(2))])).toBe('.. .. ..');
  });

  it('chat de groupe : chaque auteur a ses groupes', () => {
    expect(shape([from('a', s(0)), from('a', s(10)), from('b', s(20)), from('b', s(30)), from('a', s(40))])).toBe('.> <. .> <. ..');
  });

  it('un message seul n’est groupé avec rien', () => {
    expect(shape([peer(s(0))])).toBe('..');
    expect(shape([])).toBe('');
  });
});
