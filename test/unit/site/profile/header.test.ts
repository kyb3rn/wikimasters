import { describe, expect, it } from 'vitest';
import { readProfilePlayer, splitProfileLine } from '@/site/profile';

describe('splitProfileLine', () => {
  it('sépare le nombre de cartes des autres textes, sans leur « · »', () => {
    expect(splitProfileLine(['1 416 cartes', '· Depuis sept. 2026'])).toEqual({
      cards: { value: '1 416', label: 'Cartes' },
      seen: undefined,
      details: ['Depuis sept. 2026'],
    });
  });

  it('met à part la dernière activité d’un ami, « Vu il y a… » ou « En ligne récemment », et garde le singulier', () => {
    expect(splitProfileLine(['1 carte', '· Depuis août 2026', '· Vu il y a 33 min'])).toEqual({
      cards: { value: '1', label: 'Carte' },
      seen: 'Vu il y a 33 min',
      details: ['Depuis août 2026'],
    });
    expect(splitProfileLine(['45 583 cartes', '· Depuis août 2026', '· En ligne récemment']).seen).toBe('En ligne récemment');
  });

  it('sans nombre de cartes (compteurs pas encore reçus) : seulement les autres textes', () => {
    expect(splitProfileLine(['· Depuis sept. 2026', ''])).toEqual({ cards: undefined, seen: undefined, details: ['Depuis sept. 2026'] });
  });
});

describe('readProfilePlayer', () => {
  /** Composant dont les états sont ces valeurs, dans l'ordre. */
  const component = (...values: unknown[]) => ({
    memoizedProps: {},
    return: null,
    memoizedState: values.reduceRight<unknown>((next, value) => ({ memoizedState: value, queue: { dispatch() {} }, next }), null),
  });
  /** Nœud de l'en-tête, rendu sous ce composant. */
  const rootUnder = (page: object) => ({ '__reactFiber$test': { memoizedProps: {}, return: page } }) as unknown as HTMLElement;

  it('le profil dans l’état de la page : identifiant, pseudo exact, photo et son cadrage', () => {
    const page = component(false, { id: 'u-autre', username: 'Autre' }, { id: 'u-ami', username: ' Ami  du  jeu ', avatar_url: null });
    expect(readProfilePlayer({ root: rootUnder(page), name: 'Ami du jeu' })).toEqual({
      id: 'u-ami',
      username: ' Ami  du  jeu ',
      avatarUrl: null,
      avatarPosX: undefined,
      avatarPosY: undefined,
    });
    const framed = component({ id: 'u-ami', username: 'Ami', avatar_url: 'https://img/a.png', avatar_pos_x: 30, avatar_pos_y: 70 });
    expect(readProfilePlayer({ root: rootUnder(framed), name: 'Ami' })).toMatchObject({
      avatarUrl: 'https://img/a.png',
      avatarPosX: 30,
      avatarPosY: 70,
    });
  });

  it('pas de profil de ce pseudo : rien', () => {
    expect(readProfilePlayer({ root: rootUnder(component({ id: 1, username: 'Ami' })), name: 'Ami' })).toBeUndefined();
  });
});
