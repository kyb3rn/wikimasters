import { describe, expect, it } from 'vitest';
import { matchRoute } from '@/core/router';

describe('matchRoute', () => {
  it('reconnaît un chemin fixe', () => {
    expect(matchRoute('/pulls', '/pulls')).toEqual({});
    expect(matchRoute('/pulls', '/collection')).toBeNull();
  });

  it('ignore les barres en trop', () => {
    expect(matchRoute('/pulls', '/pulls/')).toEqual({});
    expect(matchRoute('/', '/')).toEqual({});
  });

  it('extrait les segments variables, décodés', () => {
    expect(matchRoute('/marketplace/:id', '/marketplace/3f2a-11')).toEqual({ id: '3f2a-11' });
    expect(matchRoute('/profile/:pseudo', '/profile/%C3%89lodie')).toEqual({ pseudo: 'Élodie' });
  });

  it('garde un segment mal encodé tel quel', () => {
    expect(matchRoute('/profile/:pseudo', '/profile/%E0%A4%A')).toEqual({ pseudo: '%E0%A4%A' });
  });

  it('exige le même nombre de segments sans joker', () => {
    expect(matchRoute('/marketplace', '/marketplace/abc')).toBeNull();
    expect(matchRoute('/marketplace/:id', '/marketplace')).toBeNull();
  });

  it('accepte tout le reste avec un joker final, y compris rien', () => {
    expect(matchRoute('/profile/*', '/profile/x/collection')).toEqual({ '*': 'x/collection' });
    expect(matchRoute('/profile/*', '/profile')).toEqual({ '*': '' });
    expect(matchRoute('/profile/*', '/pulls')).toBeNull();
  });

  it("compare la requête d'une vue : mêmes paramètres des deux côtés, dans n'importe quel ordre", () => {
    expect(matchRoute('/collection?vue=revente', '/collection?vue=revente')).toEqual({});
    expect(matchRoute('/a?x=1&vue=b', '/a?vue=b&x=1')).toEqual({});
    expect(matchRoute('/collection?vue=revente', '/collection?vue=autre')).toBeNull();
    expect(matchRoute('/collection?vue=revente', '/collection')).toBeNull();
  });

  it('ne reconnaît pas une page affichée dans une vue avec un motif sans requête', () => {
    expect(matchRoute('/collection', '/collection?vue=revente')).toBeNull();
    expect(matchRoute('/profile/:name', '/profile/x?vue=y')).toBeNull();
  });
});
